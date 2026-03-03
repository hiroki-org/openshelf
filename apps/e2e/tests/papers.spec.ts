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
        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        const detailRes = await page.request.get(`/api/papers/${paperId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(detailRes.ok()).toBeTruthy();
        const detail = await detailRes.json();
        const fileId = detail.files[0].id;

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
        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        const detailRes = await page.request.get(`/api/papers/${paperId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(detailRes.ok()).toBeTruthy();
        const detail = await detailRes.json();
        const fileId = detail.files[0].id;

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
});
