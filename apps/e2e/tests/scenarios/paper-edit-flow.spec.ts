import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';

test.describe('Paper Edit Flow', () => {
  test('メタデータ編集後に詳細画面へ反映されること', async ({ page }) => {
    await loginAsTestUser(page);
    const initialTitle = `Edit Source ${randomUUID().slice(0, 8)}`;
    const paperId = await uploadPublicPaper(page, initialTitle);

    const updatedTitle = `Edited Title ${randomUUID().slice(0, 8)}`;
    const updatedVenue = `Venue ${randomUUID().slice(0, 5)}`;
    const updatedExternalUrl = `https://example.org/paper-${randomUUID().slice(0, 8)}`;
    const updatedDescription = `## 実行手順\n\n- [x] setup\n\n\`\`\`bash\nnpm run test\n\`\`\`\n\n<script>alert("xss")</script>`;

    await page.goto(`/papers/${paperId}/edit`);
    await expect(page.getByRole('heading', { name: 'メタデータの編集' })).toBeVisible();

    await page.getByLabel(/タイトル/).fill(updatedTitle);
    await page.getByLabel(/概要/).fill('E2E edit abstract');
    await page.getByLabel(/発表年/).fill('2024');
    await page.getByLabel(/発表場所/).fill(updatedVenue);
    await page.getByLabel('DOI').fill('10.1234/e2e-test');
    await page.getByLabel(/外部リンク/).fill(updatedExternalUrl);
    await page.getByLabel(/タグ/).fill('ml, e2e');
    await page.getByLabel(/Description/).fill(updatedDescription);
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText('実行手順')).toBeVisible();
    await page.getByRole('button', { name: 'Write' }).click();
    await page.getByRole('button', { name: '保存する' }).click();

    await expect(page).toHaveURL(new RegExp(`/papers/${paperId}$`));
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();
    await expect(page.getByText(updatedVenue)).toBeVisible();
    await expect(page.getByRole('link', { name: '正式版はこちら' })).toHaveAttribute(
      'href',
      updatedExternalUrl,
    );
    await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible();
    await expect(page.getByText('実行手順')).toBeVisible();
    await expect(page.getByText('alert("xss")')).toHaveCount(0);

    const citeButton = page.getByRole('button', { name: /Cite/ });
    await citeButton.click();
    await expect(page.getByRole('menuitem', { name: 'BibTeX' })).toBeVisible();
  });

  test('非著者ユーザーは編集画面へ入れないこと', async ({ page, browser }) => {
    await loginAsTestUser(page);
    const paperId = await uploadPublicPaper(page, `Edit Guard ${randomUUID().slice(0, 8)}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await loginAsTestUser(otherPage, { name: `guest-${randomUUID().slice(0, 6)}` });
      await otherPage.goto(`/papers/${paperId}/edit`);
      await otherPage.waitForURL((url) => !url.pathname.endsWith('/edit'));

      await expect(otherPage).toHaveURL(new RegExp(`/papers/${paperId}$`));
      await expect(
        otherPage.getByRole('heading', { name: /Edit Guard/ }),
      ).toBeVisible();
      await expect(
        otherPage.getByRole('heading', { name: 'メタデータの編集' }),
      ).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
  });
});
