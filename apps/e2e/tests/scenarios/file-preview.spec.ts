import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';
import { generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('File Preview', () => {
    test('pdf preview section is shown for uploaded paper', async ({ page }) => {
        await loginAsTestUser(page);

        const title = generateTestPaperTitle();
        const paperId = await uploadPublicPaper(page, title);

        await page.goto(`/papers/${paperId}`);
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
        await expect(page.getByText('PDFプレビュー')).toBeVisible();
    });
});
