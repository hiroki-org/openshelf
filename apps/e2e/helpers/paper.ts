import { Page } from '@playwright/test';

export async function uploadPaper(page: Page, opts: { title: string, visibility: string, filePath: string }): Promise<string> {
  await page.goto('/upload');
  await page.fill('#paper-title', opts.title);
  await page.selectOption('#paper-visibility', opts.visibility);
  
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('button:has-text("クリックしてファイルを選択")');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(opts.filePath);

  await page.click('button[type="submit"]');

  await page.waitForURL(/\/papers\/.+/);
  const parts = page.url().split('/');
  return parts[parts.length - 1];
}
