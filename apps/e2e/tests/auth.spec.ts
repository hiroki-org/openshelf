import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('認証', () => {
    test('テスト用トークンを注入後、ページをリロードすると認証済み状態になること', async ({ page }) => {
        await loginAsTestUser(page, { name: 'Token User' });
        
        await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible();
        await expect(page.getByText('Token User')).toBeVisible();
    });

    test('認証済みユーザーでトップページにアクセスすると、ユーザー名またはアバターが表示されること', async ({ page }) => {
        await loginAsTestUser(page, { name: 'Token User' });

        await expect(page.getByText('Token User')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'マイ論文' })).toBeVisible();
    });

    test('ログアウト操作後、localStorage からトークンが削除され、未認証状態に戻ること', async ({ page }) => {
        await loginAsTestUser(page, { name: 'Token User' });
        
        // ログアウトをクリック
        await page.getByRole('button', { name: 'ログアウト' }).click();

        // 未認証状態ボタンの表示を確認 (ヘッダーとメインコンテンツの複数箇所に存在する可能性があるため、first を使うか、特定の場所を指定する)
        await expect(page.getByRole('button', { name: 'GitHubでログイン' }).first()).toBeVisible();

        // localStorage の確認
        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        expect(token).toBeNull();
    });
});
