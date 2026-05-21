import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';

test.describe('Cite & Download', () => {
  test('CiteメニューからBibTeXをコピーして閉じること', async ({ page }) => {
    await loginAsTestUser(page, { name: `citer-${randomUUID().slice(0, 6)}` });
    const title = `Cite Target ${randomUUID().slice(0, 8)}`;
    const paperId = await uploadPublicPaper(page, title);

    await page.addInitScript(() => {
      const clipboardMock = {
        writeText: async (_text: string): Promise<void> => {},
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get: () => clipboardMock,
      });
    });

    await page.goto(`/papers/${paperId}`);

    await page.getByRole('button', { name: '📋 Cite' }).click();
    await page.getByRole('menuitem', { name: 'BibTeX' }).click();

    await expect(page.getByText('コピーしました')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'BibTeX' })).toHaveCount(0);
  });

  test('論文詳細のダウンロードボタンでファイルを取得できること', async ({ page }) => {
    await loginAsTestUser(page, { name: `downloader-${randomUUID().slice(0, 6)}` });
    const title = `Download Target ${randomUUID().slice(0, 8)}`;
    const paperId = await uploadPublicPaper(page, title);

    await page.goto(`/papers/${paperId}`);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('button', { name: /test-paper\.pdfをダウンロード/ })
        .click(),
    ]);

    expect(download.suggestedFilename().toLowerCase()).toContain('.pdf');
  });
});
