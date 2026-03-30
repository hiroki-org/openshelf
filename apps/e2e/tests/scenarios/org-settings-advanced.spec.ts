import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { createOrg } from '../../helpers/org';

test.describe('Org Settings Advanced', () => {
  test('組織設定で一般情報の更新とメンバー追加ができること', async ({ page, browser }) => {
    const orgName = `Org-${randomUUID().slice(0, 6)}`;
    const orgSlug = `org-${randomUUID().slice(0, 8)}`;

    await loginAsTestUser(page, { name: `admin-${randomUUID().slice(0, 6)}` });
    await createOrg(page, {
      name: orgName,
      slug: orgSlug,
      description: 'initial description',
    });

    await page.goto(`/orgs/${orgSlug}/settings`);
    await page.getByLabel('組織名').fill(`${orgName}-updated`);
    await page.getByLabel('説明').fill('updated description');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存しました')).toBeVisible();

    await page.goto(`/orgs/${orgSlug}/settings`);
    await expect(page.getByLabel('説明')).toHaveValue('updated description');

    const newMemberContext = await browser.newContext();
    const newMemberPage = await newMemberContext.newPage();
    const newMemberName = `member-${randomUUID().slice(0, 6)}`;
    try {
      const newMember = await loginAsTestUser(newMemberPage, {
        name: newMemberName,
        githubId: randomUUID(),
      });

      await page.goto(`/orgs/${orgSlug}/settings`);
      await page.getByRole('button', { name: 'メンバー' }).click();
      await page.getByLabel('メンバー検索').fill(newMember.githubId);

      const candidateRow = page.locator('li', { hasText: newMemberName }).first();
      await expect(candidateRow).toBeVisible({ timeout: 15_000 });
      await candidateRow.getByRole('button', { name: '追加' }).click();

      const memberRow = page.locator('li', { hasText: newMemberName }).first();
      await expect(memberRow).toBeVisible();
      await expect(memberRow.locator('select')).toHaveValue('member');
    } finally {
      await newMemberContext.close();
    }
  });
});
