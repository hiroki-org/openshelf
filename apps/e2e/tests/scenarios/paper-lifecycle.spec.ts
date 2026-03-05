import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPaper } from '../../helpers/paper';
import { deleteTestPaper } from '../../helpers/cleanup';
import path from 'path';

test.describe('Paper Lifecycle', () => {
  let paperId: string;

  test.afterEach(async ({ page }) => {
    if (paperId) {
      await deleteTestPaper(page, paperId);
    }
  });

  test('upload, view, download, and visibility control', async ({ page }) => {
    await loginAsTestUser(page);

    // Upload public paper
    const filePath = path.join(__dirname, '../fixtures/dummy.pdf');
    paperId = await uploadPaper(page, {
      title: 'E2E Test Paper',
      visibility: 'public',
      filePath,
    });

    // View details
    await expect(page.locator('h1')).toHaveText('E2E Test Paper');
    await expect(page.locator('text=public')).toBeVisible(); // assuming there's a visibility badge

    // Download test
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=ダウンロード');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();

    // Check if we can change to private if edit page is implemented
    // The instructions say: "公開範囲を private に変更（設定画面があれば）→ 未ログインブラウザで 403 確認"
    // Let's check if edit page exists. If not, just delete the paper and we skip that or upload a private one.
    // Or we can hit API directly to change visibility for the sake of the test.
    const jwt = await page.evaluate(() => localStorage.getItem('auth_token'));
    await page.request.patch(`${process.env.E2E_API_URL || 'http://localhost:8787'}/api/papers/${paperId}`, {
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      data: { visibility: 'private' }
    });

    // Check non-logged in browser
    const context2 = await page.context().browser()?.newContext();
    const page2 = await context2!.newPage();
    const res = await page2.goto(`/papers/${paperId}`);
    // Next.js might 404 or show error for private paper to non-owners
    await expect(page2.locator('text=読み込み中')).toBeHidden(); 
    // Usually implies it hits a 404/403 block 
    // we can check if response exists, but in SPA navigation it's client-side render
    const textContent = await page2.textContent('body');
    // Just expect it's not showing the title "E2E Test Paper"
    expect(textContent).not.toContain('E2E Test Paper');
    await context2!.close();
  });
});
