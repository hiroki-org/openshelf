import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';
import { generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('OG Metadata', () => {
    test('paper page emits og metadata', async ({ page }) => {
        await loginAsTestUser(page);

        const title = generateTestPaperTitle();
        const paperId = await uploadPublicPaper(page, title);

        await page.goto(`/papers/${paperId}`);

        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');

        expect(ogTitle).toBeTruthy();
        expect(ogTitle).toContain(title);
        expect(ogType).toBe('article');
    });
});
