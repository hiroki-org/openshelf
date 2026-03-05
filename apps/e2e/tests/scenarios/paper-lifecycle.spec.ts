import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper, uploadPrivatePaper } from '../../helpers/paper';
import { generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('Paper Lifecycle', () => {
    test('論文のアップロード、表示、ダウンロード、非公開アクセス制御', async ({ browser, page }) => {
        await loginAsTestUser(page);

        // Public paper
        const publicTitle = generateTestPaperTitle();
        const publicId = await uploadPublicPaper(page, publicTitle);

        await page.goto(`/papers/${publicId}`);
        await expect(page.getByRole('heading', { name: publicTitle })).toBeVisible();
        await expect(page.getByText('公開')).toBeVisible();

        // Download check (button exists and can be clicked)
        await page.getByRole('button', { name: 'ダウンロード' }).first().click();

        // Private paper
        const privateTitle = generateTestPaperTitle();
        const privateId = await uploadPrivatePaper(page, privateTitle);

        // Check private works for owner
        await page.goto(`/papers/${privateId}`);
        await expect(page.getByRole('heading', { name: privateTitle })).toBeVisible();

        // Check unauthorized access
        const context = await browser.newContext();
        const guestPage = await context.newPage();
        await guestPage.goto(`/papers/${privateId}`);
        await expect(
            guestPage
                .locator('text=ログインが必要です')
                .or(guestPage.locator('text=この論文を閲覧する権限がありません'))
                .or(guestPage.locator('text=論文が見つかりません'))
                .or(guestPage.locator('text=論文の取得に失敗しました')),
        ).toBeVisible();

        await context.close();
    });
});
