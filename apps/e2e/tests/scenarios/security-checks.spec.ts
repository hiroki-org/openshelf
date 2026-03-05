import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPrivatePaper } from '../../helpers/paper';
import { generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('Security Checks', () => {
    test('unauthenticated user is redirected from upload page', async ({ page }) => {
        await page.goto('/upload');
        await page.waitForURL((url) => url.pathname !== '/upload');
        expect(page.url()).not.toContain('/upload');
    });

    test('private paper is not visible to guest', async ({ browser, page }) => {
        await loginAsTestUser(page);
        const title = generateTestPaperTitle();
        const paperId = await uploadPrivatePaper(page, title);

        const guestContext = await browser.newContext();
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`/papers/${paperId}`);

        await expect(
            guestPage
                .locator('text=ログインが必要です')
                .or(guestPage.locator('text=この論文を閲覧する権限がありません'))
                .or(guestPage.locator('text=論文が見つかりません'))
                .or(guestPage.locator('text=論文の取得に失敗しました')),
        ).toBeVisible();

        await guestContext.close();
    });
});
