import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import path from 'path';
import { loginAsTestUser } from '../../helpers/auth';

test.describe('Upload Validation', () => {
  test('タイトル未入力でアップロード時にバリデーションエラーを表示すること', async ({
    page,
  }) => {
    await loginAsTestUser(page, { name: `uploader-${randomUUID().slice(0, 6)}` });
    await page.goto('/upload');
    await page.locator('form').evaluate((form) => {
      form.setAttribute('novalidate', 'true');
    });

    await page.getByLabel('公開範囲').selectOption('public');
    await page.setInputFiles(
      'input[type="file"]',
      path.resolve(__dirname, '../../fixtures/test-paper.pdf'),
    );
    await page.getByRole('button', { name: '論文をアップロードする' }).click();

    await expect(page.getByText('タイトルは必須です')).toBeVisible();
  });

  test('ファイル未添付でアップロード時にバリデーションエラーを表示すること', async ({ page }) => {
    await loginAsTestUser(page, { name: `uploader-${randomUUID().slice(0, 6)}` });
    await page.goto('/upload');
    await page.locator('form').evaluate((form) => {
      form.setAttribute('novalidate', 'true');
    });

    await page.getByLabel(/タイトル/).fill(`Validation ${randomUUID().slice(0, 8)}`);
    await page.getByRole('button', { name: '論文をアップロードする' }).click();

    await expect(page.getByText('ファイルを1つ以上添付してください')).toBeVisible();
  });
});
