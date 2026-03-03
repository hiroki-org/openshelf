import { test, expect, Page } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';
import path from 'path';
import { randomUUID } from 'crypto';

async function uploadPaper(page: Page, options: { title: string; visibility: 'public' | 'private'; filePath: string }): Promise<string> {
    await page.goto('/upload');
    await page.getByLabel(/タイトル/).fill(options.title);
    await page.getByLabel('公開範囲').selectOption(options.visibility);
    await page.setInputFiles('input[type="file"]', options.filePath);

    const uploadResponsePromise = page.waitForResponse(response =>
        response.url().includes('/api/papers') && response.request().method() === 'POST'
    );

    await page.getByRole('button', { name: 'アップロード', exact: true }).click();

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
        const authSecret = process.env.TEST_AUTH_SECRET as string;

        const setupRes = await page.request.post('/api/auth/test-org', {
            headers: { 'x-test-auth-secret': authSecret },
            data: { userId: memberUserId, orgId }
        });
        expect(setupRes.ok()).toBeTruthy();

        // 2. APIで org_only の論文をアップロード
        const pdfPath = path.resolve(__dirname, '../fixtures/test-paper.pdf');
        const fs = require('fs');
        const pdfContent = fs.readFileSync(pdfPath);
        
        const uploadRes = await page.request.post('/api/papers', {
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
        expect(uploadRes.ok()).toBeTruthy();
        const uploadData = await uploadRes.json();
        const paperId = uploadData.paper.id;

        // 3. ファイルIDを取得
        const fileId = await getFirstFileId(page, paperId);

        // 4. メンバーコンテキストによるダウンロード -> 200
        const memberDownloadRes = await page.request.get(`/api/papers/${paperId}/files/${fileId}/download`, {
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

            const nonMemberDownloadRes = await nonMemberPage.request.get(`/api/papers/${paperId}/files/${fileId}/download`, {
                headers: { 'Authorization': `Bearer ${nonMemberToken}` }
            });
            expect(nonMemberDownloadRes.status()).toBe(403);
        } finally {
            await nonMemberContext.close();
        }
    });
});
