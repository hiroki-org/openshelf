import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';

test.describe('Profile Settings', () => {
  test('表示名の保存と未設定へのリセットがヘッダーに反映されること', async ({ page }) => {
    const baseName = `settings-base-${randomUUID().slice(0, 8)}`;
    const updatedDisplayName = `表示名-${randomUUID().slice(0, 8)}`;

    await loginAsTestUser(page, { name: baseName });
    await page.goto('/settings');

    await page.getByLabel('表示名').fill(updatedDisplayName);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存しました')).toBeVisible();

    await page.goto('/');
    await expect(page.locator('header')).toContainText(updatedDisplayName);

    await page.goto('/settings');
    await page.getByLabel('表示名').fill('');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存しました')).toBeVisible();

    await page.goto('/');
    await expect(page.locator('header')).toContainText(baseName);
  });
});
