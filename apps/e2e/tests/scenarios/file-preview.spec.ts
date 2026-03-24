import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';
import { generateTestPaperTitle } from '../../helpers/fixtures';
import path from 'path';

test.describe('File Preview', () => {
    test('pdf preview section is shown for uploaded paper', async ({ page }) => {
        await loginAsTestUser(page);

        const title = generateTestPaperTitle();
        const paperId = await uploadPublicPaper(page, title);

        await page.goto(`/papers/${paperId}`);
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
        await expect(page.getByText('PDFプレビュー')).toBeVisible();
    });

    test('pptx preview shows slide content with paging controls', async ({ page }) => {
        await loginAsTestUser(page);

        const title = generateTestPaperTitle();
        const paperId = await uploadPublicPaper(page, title, {
            filePath: path.resolve(__dirname, '../../fixtures/test-slides.pptx'),
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            fileType: 'slides',
        });

        await page.goto(`/papers/${paperId}`);
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
        await expect(page.getByText('PPTXプレビュー')).toBeVisible();
        await expect(page.getByTestId('pptx-viewer')).toBeVisible();
        await expect(page.getByText('Slide 1')).toBeVisible();
        await expect(page.getByText('OpenShelf PPTX Preview 1')).toBeVisible();
        await expect(page.getByText('1 / 2')).toBeVisible();

        await page.getByTestId('pptx-viewer').getByRole('button', { name: '次へ' }).click();
        await expect(page.getByText('Slide 2')).toBeVisible();
        await expect(page.getByText('OpenShelf PPTX Preview 2')).toBeVisible();
    });

    test('pptx preview is visible on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await loginAsTestUser(page);

        const title = generateTestPaperTitle();
        const paperId = await uploadPublicPaper(page, title, {
            filePath: path.resolve(__dirname, '../../fixtures/test-slides.pptx'),
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            fileType: 'slides',
        });

        await page.goto(`/papers/${paperId}`);
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
        await expect(page.getByTestId('pptx-viewer')).toBeVisible();
        await expect(page.getByText('OpenShelf PPTX Preview 1')).toBeVisible();
    });
});
