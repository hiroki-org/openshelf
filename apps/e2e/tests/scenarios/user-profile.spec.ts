import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';

test.describe('User Profile', () => {
  test('ユーザープロフィールページが正しく表示され、RSSボタンが確認できること', async ({ page }) => {
    const userName = `user-${randomUUID().slice(0, 8)}`;
    const user = await loginAsTestUser(page, { name: userName });

    // Go to user profile page
    await page.goto(`/users/${user.sub}`);

    // Check if user's name is displayed
    await expect(page.getByRole('heading', { name: userName })).toBeVisible();

    // Check if feed button is visible
    const feedButton = page.getByRole('button', { name: /Feed/i });
    await expect(feedButton).toBeVisible();

    // Click the feed button to show the popup
    await feedButton.click();

    // Check if the URL is in the textarea or the link
    await expect(page.getByRole('link', { name: '開く' })).toBeVisible();

    // Check if "+ 新規作成" link is visible since it's the own profile
    await expect(page.getByRole('link', { name: '+ 新規作成' })).toBeVisible();
  });
});
