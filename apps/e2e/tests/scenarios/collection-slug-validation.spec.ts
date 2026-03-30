import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { createCollection } from '../../helpers/collection';

test.describe('Collection Slug Validation', () => {
  test('既存slugを指定すると使用済みとして作成できないこと', async ({ page }) => {
    await loginAsTestUser(page, { name: `collector-${randomUUID().slice(0, 6)}` });

    const slug = `dup-${randomUUID().slice(0, 8)}`;
    await createCollection(
      page,
      { type: 'user' },
      { name: 'First Collection', slug, visibility: 'public' },
    );

    await page.goto('/collections/new');
    await page.getByLabel('name', { exact: true }).fill('Second Collection');
    await page.getByLabel('slug', { exact: true }).fill(slug);

    await expect(page.getByText('✗ 使用済み')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '作成', exact: true })).toBeDisabled();
  });
});
