import { test, expect, Page } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';

async function uploadPaper(page: Page, options: { title: string; visibility: 'public' | 'private'; filePath: string }): Promise<string> {
    await page.goto('/upload');
    await page.getByLabel(/タイトル/).fill(options.title);
    await page.getByLabel('公開範囲').selectOption(options.visibility);
    await page.setInputFiles('input[type="file"]', options.filePath);

    const uploadResponsePromise = page.waitForResponse(response =>
        response.url().includes('/api/papers') && response.request().method() === 'POST'
    );

    await page.getByRole('button', { name: '論文をアップロードする' }).click();

    const response = await uploadResponsePromise;
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.paper).toBeDefined();
    expect(data.paper.id).toBeDefined();
    return data.paper.id;
}

async function getFirstFileId(page: Page, paperId: string): Promise<string> {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token, 'auth_token が未設定です').toBeTruthy();

    const detailRes = await page.request.get(`/api/papers/${paperId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    expect(detailRes.ok()).toBeTruthy();

    const detail = await detailRes.json();
    expect(Array.isArray(detail.files) && detail.files.length > 0).toBeTruthy();
    return detail.files[0].id as string;
}

async function expectPdfPreviewRendered(page: Page, expectedTexts: string[]): Promise<void> {
    const previewSurface = page.getByTestId('pdf-viewer-surface');
    const renderedPdfPage = previewSurface.locator('.react-pdf__Page').first();
    const renderedPdfCanvas = previewSurface.locator('.react-pdf__Page canvas').first();
    const textLayer = previewSurface.locator('.react-pdf__Page__textContent').first();
    const previewFallback = page.getByText('プレビューを読み込めません', { exact: true });

    await expect(previewSurface).toBeVisible();
    await expect(renderedPdfPage).toBeVisible({ timeout: 20000 });
    await expect(renderedPdfCanvas).toBeVisible({ timeout: 20000 });
    await expect(textLayer).toHaveCount(1, { timeout: 20000 });
    await expect(previewFallback).toHaveCount(0);

    const canvasBounds = await renderedPdfCanvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            naturalWidth: canvas.width,
            naturalHeight: canvas.height
        };
    });

    expect(canvasBounds.width).toBeGreaterThan(0);
    expect(canvasBounds.height).toBeGreaterThan(0);
    expect(canvasBounds.naturalWidth).toBeGreaterThan(0);
    expect(canvasBounds.naturalHeight).toBeGreaterThan(0);

    const rawText = await textLayer.textContent();
    const normalizedText = (rawText ?? '').replace(/\s+/g, '').normalize('NFKC');

    for (const expectedText of expectedTexts) {
        expect(normalizedText).toContain(expectedText.replace(/\s+/g, '').normalize('NFKC'));
    }
}

test.describe('論文アップロード', () => {
    test('認証済みユーザーが /upload ページからPDFをアップロードできること、アップロード後、トップページ（マイ論文一覧）に論文タイトルが表示されること', async ({ page }) => {
        const uniqueTitle = `テスト論文 - ${randomUUID()}`;
        await loginAsTestUser(page);

        await uploadPaper(page, {
            title: uniqueTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        // マイ論文一覧(トップページ)へ
        await page.goto('/');

        await expect(page.getByText(uniqueTitle)).toBeVisible();
    });
});

test.describe('非公開論文の詳細閲覧', () => {
    test('非公開論文をアップロードした著者本人が、詳細ページを開けること、未認証状態でアクセスするとエラー表示されること', async ({ page, browser }) => {
        const paperTitle = `Secret Paper - ${randomUUID()}`;
        await loginAsTestUser(page);

        const testPaperId = await uploadPaper(page, {
            title: paperTitle,
            visibility: 'private',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        // 著者本人によるアクセス (詳細ページへの遷移はアプリ側で行われる場合もあるが明示的に遷移)
        await page.goto(`/papers/${testPaperId}`);
        await expect(page.getByRole('heading', { name: paperTitle })).toBeVisible();

        // 未認証ユーザーによるアクセス
        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            await unauthPage.goto(`/papers/${testPaperId}`);

            // 401 によるエラーメッセージが表示されること
            await expect(unauthPage.getByText('ログインが必要です')).toBeVisible();
        } finally {
            await unauthContext.close();
        }
    });

    test('公開論文は未認証でも詳細ページを閲覧できること', async ({ page, browser }) => {
        const publicTitle = `Public Paper - ${randomUUID()}`;
        await loginAsTestUser(page);

        const publicPaperId = await uploadPaper(page, {
            title: publicTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        // 未認証ユーザーによるアクセス
        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            await unauthPage.goto(`/papers/${publicPaperId}`);
            await expect(unauthPage.getByRole('heading', { name: publicTitle })).toBeVisible();
        } finally {
            await unauthContext.close();
        }
    });

    test('詳細ページの戻るボタンと著者リンクが正しい遷移先を指すこと', async ({ page }) => {
        const author = await loginAsTestUser(page, { name: 'Navigation User' });
        const paperTitle = `Navigation Paper - ${randomUUID()}`;
        const paperId = await uploadPaper(page, {
            title: paperTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        await page.goto(`/papers/${paperId}`);
        await expect(page.getByRole('heading', { name: paperTitle })).toBeVisible();
        await expect(page.getByRole('link', { name: '← ダッシュボードに戻る' })).toHaveAttribute('href', '/');
        await expect(page.getByRole('link', { name: 'Navigation User' })).toHaveAttribute(
            'href',
            `/users/${author.sub}`,
        );

        await page.getByRole('link', { name: '← ダッシュボードに戻る' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('heading', { name: 'マイ論文' })).toBeVisible();
    });
});

test.describe('PDFプレビュー', () => {
    test('公開論文の詳細ページでPDFビューワーが表示されること', async ({ page, browser }) => {
        const publicTitle = `Public Preview - ${randomUUID()}`;
        await loginAsTestUser(page);

        const publicPaperId = await uploadPaper(page, {
            title: publicTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            await unauthPage.goto(`/papers/${publicPaperId}`);
            const renderedPdfPage = unauthPage.locator('.react-pdf__Page');
            const previewFallback = unauthPage.getByText('プレビューを読み込めません');
            await expect(renderedPdfPage.or(previewFallback)).toBeVisible({ timeout: 20000 });
        } finally {
            await unauthContext.close();
        }
    });

    test('公開論文の詳細ページで英語PDFプレビューが描画されること', async ({ page, browser }) => {
        const publicTitle = `English Preview - ${randomUUID()}`;
        await loginAsTestUser(page);

        const publicPaperId = await uploadPaper(page, {
            title: publicTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper-en.pdf')
        });

        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            await unauthPage.goto(`/papers/${publicPaperId}`);
            await expect(unauthPage.getByRole('heading', { name: publicTitle })).toBeVisible();
            await expectPdfPreviewRendered(unauthPage, [
                'OpenShelfEnglishrenderingcheck',
                'EnglishtextforPDFpreviewtest.'
            ]);
        } finally {
            await unauthContext.close();
        }
    });

    test('公開論文の詳細ページで日本語と英語を含むPDFプレビューが描画されること', async ({ page, browser }) => {
        const publicTitle = `Japanese Preview - ${randomUUID()}`;
        await loginAsTestUser(page);

        const publicPaperId = await uploadPaper(page, {
            title: publicTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper-ja.pdf')
        });

        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            await unauthPage.goto(`/papers/${publicPaperId}`);
            await expect(unauthPage.getByRole('heading', { name: publicTitle })).toBeVisible();
            await expectPdfPreviewRendered(unauthPage, [
                'OpenShelf',
                '日本語PDFプレビュー確認'
            ]);
        } finally {
            await unauthContext.close();
        }
    });

    test('PDF内検索で一致箇所がハイライトされ、現在一致ページに枠線が表示されること', async ({ page }) => {
        const publicTitle = `Search Highlight - ${randomUUID()}`;
        await loginAsTestUser(page);

        const publicPaperId = await uploadPaper(page, {
            title: publicTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper-en.pdf')
        });

        await page.goto(`/papers/${publicPaperId}`);
        await expect(page.getByRole('heading', { name: publicTitle })).toBeVisible();
        await expectPdfPreviewRendered(page, [
            'OpenShelfEnglishrenderingcheck',
            'EnglishtextforPDFpreviewtest.'
        ]);

        await page.getByRole('searchbox', { name: 'PDF内検索' }).fill('OpenShelf');
        await expect(page.getByText('1 / 1')).toBeVisible({ timeout: 20000 });

        const textLayer = page.locator('.react-pdf__Page__textContent').first();
        const highlighted = textLayer.locator('mark.highlight').first();
        await expect(highlighted).toBeVisible();
        const highlightBackground = await highlighted.evaluate((node) =>
            window.getComputedStyle(node).backgroundColor,
        );
        expect(highlightBackground).not.toBe('rgba(0, 0, 0, 0)');
        expect(highlightBackground).not.toBe('transparent');

        const activePageWrapper = page.locator('[data-page-number="1"]').first();
        await expect(activePageWrapper).toHaveClass(/ring-2 ring-blue-500/);
    });
});

test.describe('論文ダウンロード', () => {
    test('公開論文のファイルは未認証でもダウンロードできること', async ({ page, browser }) => {
        const publicTitle = `Public Download - ${randomUUID()}`;
        await loginAsTestUser(page);

        const paperId = await uploadPaper(page, {
            title: publicTitle,
            visibility: 'public',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        // 論文詳細APIを叩いてファイルIDを取得 (認証済みコンテキストを使用)
        const fileId = await getFirstFileId(page, paperId);

        // 未認証コンテキストによるダウンロード
        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            const downloadRes = await unauthPage.request.get(`/api/papers/${paperId}/files/${fileId}/download`);
            expect(downloadRes.status()).toBe(200);
            expect(downloadRes.headers()['content-type']).toBe('application/pdf');
            expect(downloadRes.headers()['content-disposition']).toContain('attachment');
        } finally {
            await unauthContext.close();
        }
    });

    test('非公開論文のファイルは未認証だと401エラーになること', async ({ page, browser }) => {
        const secretTitle = `Secret Download - ${randomUUID()}`;
        await loginAsTestUser(page);

        const paperId = await uploadPaper(page, {
            title: secretTitle,
            visibility: 'private',
            filePath: path.resolve(__dirname, '../fixtures/test-paper.pdf')
        });

        // 論文詳細APIを叩いてファイルIDを取得 (認証済みコンテキストを使用)
        const fileId = await getFirstFileId(page, paperId);

        // 未認証コンテキストによるダウンロード
        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        try {
            const downloadRes = await unauthPage.request.get(`/api/papers/${paperId}/files/${fileId}/download`);
            expect(downloadRes.status()).toBe(401);
        } finally {
            await unauthContext.close();
        }
    });

    test('org_only論文のファイルはメンバーならダウンロードでき、非メンバーだと403エラーになること', async ({ page, browser }) => {
        const orgTitle = `Org Download - ${randomUUID()}`;
        const orgId = randomUUID();

        // 1. メンバーとしてログインし、組織を作成・所属
        const userPayload = await loginAsTestUser(page);
        const memberUserId = userPayload.sub;
        const memberToken = await page.evaluate(() => localStorage.getItem('auth_token'));
        const authSecret = process.env.TEST_AUTH_SECRET || 'test-secret';

        const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';
        const setupRes = await page.request.post(`${apiURL}/api/test-auth/test-org`, {
            headers: { 'x-test-auth-secret': authSecret },
            data: { userId: memberUserId, orgId }
        });
        expect(setupRes.ok()).toBeTruthy();

        // 2. APIで org_only の論文をアップロード
        const pdfPath = path.resolve(__dirname, '../fixtures/test-paper.pdf');
        const pdfContent = fs.readFileSync(pdfPath);

        const uploadRes = await page.request.post(`${apiURL}/api/papers`, {
            headers: { 'Authorization': `Bearer ${memberToken}` },
            multipart: {
                metadata: JSON.stringify({
                    title: orgTitle,
                    visibility: 'org_only',
                    orgId
                }),
                files_0: {
                    name: 'test-paper.pdf',
                    mimeType: 'application/pdf',
                    buffer: pdfContent,
                },
                file_types_0: 'paper'
            }
        });
        if (!uploadRes.ok()) {
            console.error(await uploadRes.text());
        }
        expect(uploadRes.ok()).toBeTruthy();
        const uploadData = await uploadRes.json();
        const paperId = uploadData.paper.id;

        // 3. ファイルIDを取得
        const fileId = await getFirstFileId(page, paperId);

        // 4. メンバーコンテキストによるダウンロード -> 200
        const memberDownloadRes = await page.request.get(`${apiURL}/api/papers/${paperId}/files/${fileId}/download`, {
            headers: { 'Authorization': `Bearer ${memberToken}` }
        });
        expect(memberDownloadRes.status()).toBe(200);
        expect(memberDownloadRes.headers()['content-type']).toBe('application/pdf');

        // 5. 非メンバーコンテキストによるダウンロード -> 403
        const nonMemberContext = await browser.newContext();
        const nonMemberPage = await nonMemberContext.newPage();
        try {
            await loginAsTestUser(nonMemberPage); // 別ユーザー(非メンバー)としてログイン
            const nonMemberToken = await nonMemberPage.evaluate(() => localStorage.getItem('auth_token'));

            const nonMemberDownloadRes = await nonMemberPage.request.get(`${apiURL}/api/papers/${paperId}/files/${fileId}/download`, {
                headers: { 'Authorization': `Bearer ${nonMemberToken}` }
            });
            expect(nonMemberDownloadRes.status()).toBe(403);
        } finally {
            await nonMemberContext.close();
        }
    });
});
