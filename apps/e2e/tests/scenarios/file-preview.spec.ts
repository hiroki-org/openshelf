import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPaper } from '../../helpers/paper';
import { deleteTestPaper } from '../../helpers/cleanup';
import path from 'path';

test.describe('File Preview', () => {
    let paperId: string;

    test.afterEach(async ({ page }) => {
        if (paperId) await deleteTestPaper(page, paperId);
    });

    test('shows fallback link on invalid PDF preview', async ({ page }) => {
        await loginAsTestUser(page);

        // Upload invalid PDF
        const filePath = path.join(__dirname, '../fixtures/dummy.pdf');
        paperId = await uploadPaper(page, {
            title: 'Preview Test Paper',
            visibility: 'public',
            filePath,
        });

        await page.goto(`/papers/${paperId}`);

        // Wait for preview area
        // PdfViewer should be present or an error fallback
        // If it throws error from react-pdf, we might see the fallback text
        await expect(page.locator('text=プレビューできません')).toBeVisible({ timeout: 10000 });
        
        // It should still have a download link or the text says download
        await expect(page.locator('a:has-text("ダウンロード")')).toBeVisible();
    });
});
