import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';

test.describe('Paper View Count', () => {
  test('showViewCount有効の論文で公開閲覧数が表示されること', async ({ page }) => {
    await loginAsTestUser(page, { name: `viewer-owner-${randomUUID().slice(0, 6)}` });
    const title = `View Count ${randomUUID().slice(0, 8)}`;
    const paperId = await uploadPublicPaper(page, title);

    await page.goto(`/papers/${paperId}/edit`);
    await page.getByLabel('公開ページに閲覧数を表示する').check();
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(page).toHaveURL(new RegExp(`/papers/${paperId}$`));
    await expect(page.getByText('公開表示中の総閲覧数')).toBeVisible();

    const guestContext = await page.context().browser()!.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await loginAsTestUser(guestPage, { name: `viewer-guest-${randomUUID().slice(0, 6)}` });
      await guestPage.goto(`/papers/${paperId}`);
      await expect(guestPage.getByText('公開表示中の総閲覧数')).toBeVisible();
    } finally {
      await guestContext.close();
    }

    await page.goto(`/papers/${paperId}`);
    await expect(page.getByText('公開表示中の総閲覧数')).toBeVisible();
    await expect(page.locator('section').filter({ hasText: '閲覧統計' })).toBeVisible();
  });
});
