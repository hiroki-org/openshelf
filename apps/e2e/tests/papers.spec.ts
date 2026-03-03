import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';
import path from 'path';
import { randomUUID } from 'crypto';

test.describe('論文アップロード', () => {
    test('認証済みユーザーが /upload ページからPDFをアップロードできること、アップロード後、トップページ（マイ論文一覧）に論文タイトルが表示されること', async ({ page }) => {
        const uniqueTitle = `テスト論文 - ${randomUUID()}`;
        await loginAsTestUser(page);

        await page.goto('/upload');

        // タイトル入力
        await page.getByLabel(/タイトル/).fill(uniqueTitle);
        
        // PDFファイル選択
        await page.setInputFiles('input[type="file"]', path.resolve(__dirname, '../fixtures/test-paper.pdf'));
        
        const uploadResponsePromise = page.waitForResponse(response => 
            response.url().includes('/api/papers') && response.request().method() === 'POST'
        );
        
        // アップロードボタンクリック
        await page.getByRole('button', { name: 'アップロード', exact: true }).click();

        await uploadResponsePromise;
        
        // マイ論文一覧(トップページ)へ
        await page.goto('/');

        await expect(page.getByText(uniqueTitle)).toBeVisible();
    });
});

test.describe('非公開論文の詳細閲覧', () => {
    test('非公開論文をアップロードした著者本人が、詳細ページを開けること、未認証状態でアクセスするとエラー表示されること', async ({ page, browser }) => {
        const paperTitle = `Secret Paper - ${randomUUID()}`;
        await loginAsTestUser(page);
        
        // アップロード (private)
        await page.goto('/upload');
        await page.getByLabel(/タイトル/).fill(paperTitle);
        await page.getByLabel('公開範囲').selectOption('private');
        await page.setInputFiles('input[type="file"]', path.resolve(__dirname, '../fixtures/test-paper.pdf'));

        const uploadResponsePromise = page.waitForResponse(response => 
            response.url().includes('/api/papers') && response.request().method() === 'POST'
        );
        
        await page.getByRole('button', { name: 'アップロード', exact: true }).click();
        
        const response = await uploadResponsePromise;
        const data = await response.json();
        const testPaperId = data.paper.id;
        
        // 著者本人によるアクセス (詳細ページへの遷移はアプリ側で行われる場合もあるが明示的に遷移)
        await page.goto(`/papers/${testPaperId}`);
        await expect(page.getByRole('heading', { name: paperTitle })).toBeVisible();

        // 未認証ユーザーによるアクセス
        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        await unauthPage.goto(`/papers/${testPaperId}`);
        
        // 401 や 404/Not Found によるエラーメッセージが表示されること
        await expect(unauthPage.getByText('論文が見つかりません').or(unauthPage.getByText('論文の取得に失敗しました'))).toBeVisible();
        await unauthContext.close();
    });

    test('公開論文は未認証でも詳細ページを閲覧できること', async ({ page, browser }) => {
        const publicTitle = `Public Paper - ${randomUUID()}`;
        await loginAsTestUser(page);

        // アップロード (public)
        await page.goto('/upload');
        await page.getByLabel(/タイトル/).fill(publicTitle);
        await page.getByLabel('公開範囲').selectOption('public');
        await page.setInputFiles('input[type="file"]', path.resolve(__dirname, '../fixtures/test-paper.pdf'));

        const uploadResponsePromise = page.waitForResponse(response => 
            response.url().includes('/api/papers') && response.request().method() === 'POST'
        );
        
        await page.getByRole('button', { name: 'アップロード', exact: true }).click();
        
        const response = await uploadResponsePromise;
        const data = await response.json();
        const publicPaperId = data.paper.id;
        
        // 未認証ユーザーによるアクセス
        const unauthContext = await browser.newContext();
        const unauthPage = await unauthContext.newPage();
        await unauthPage.goto(`/papers/${publicPaperId}`);
        
        await expect(unauthPage.getByRole('heading', { name: publicTitle })).toBeVisible();
        await unauthContext.close();
    });
});
