import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';

test.describe('Auth Flow', () => {
  test('login, access pages, and logout', async ({ page }) => {
    // Login
    const user = await loginAsTestUser(page);

    // Verify user is displayed in the header
    await expect(page.locator('header')).toContainText(user.name as string);

    // Access /upload
    await page.goto('/upload');
    await expect(page.locator('h1')).toContainText('アップロード');

    // Logout
    await page.click('button:has-text("ログアウト")');

    // Access /upload should redirect or show 401. Let's check network or page content
    await page.goto('/upload');
    // Usually it redirects home if unauthorized. Let's wait for url
    await page.waitForURL('/');
    
    // Verify header has login button
    await expect(page.locator('button:has-text("GitHubでログイン")')).toBeVisible();
  });
});
