import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe('Auth Flow', () => {
    test('ログイン状態とログアウトの確認', async ({ page }) => {
        // ログイン
        const user = await loginAsTestUser(page);

        // ナビバー等にユーザー名が表示されるか確認
        await expect(page.locator('header')).toContainText(user.name);

        await page.goto('/upload');
        await expect(page.getByRole('heading', { name: "成果物アップロード" })).toBeVisible();

        // トークンが localStorage に存在すること
        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        expect(token).toBeTruthy();

        // ログアウト処理
        await page.getByRole('button', { name: 'ログアウト' }).click();
        await expect.poll(async () => {
            return page.evaluate(() => localStorage.getItem('auth_token'));
        }).toBeNull();

        // '/upload' にアクセスすると未認証状態としてルートなどにリダイレクトされることを確認
        await page.goto('/upload');

        // 未認証だと / でリダイレクトされるなど、アクセスできないことを確認
        // UIによって挙動が違うので、とりあえず URL が '/upload' から変わるか、もしくは Login を促す状態か
        await page.waitForURL(url => url.pathname !== '/upload');
        expect(page.url()).not.toContain('/upload');
    });

    test('認証トークンで API にアクセスでき、ログアウト後は未認証になること', async ({ page }) => {
        const user = await loginAsTestUser(page);
        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        expect(token).toBeTruthy();

        const meRes = await page.request.get('/api/users/me', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        expect(meRes.status()).toBe(200);
        await expect(meRes.json()).resolves.toEqual({
            user: {
                id: user.sub,
                githubId: user.githubId,
                name: user.name,
                displayName: null,
                avatarUrl: null,
                email: null,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            },
        });

        await page.getByRole('button', { name: 'ログアウト' }).click();
        await expect.poll(async () => {
            return page.evaluate(() => localStorage.getItem('auth_token'));
        }).toBeNull();

        const unauthRes = await page.request.get('/api/users/me');
        expect(unauthRes.status()).toBe(401);
        await expect(unauthRes.json()).resolves.toEqual({
            error: 'Unauthorized',
        });
    });
});
