import { test, expect } from '@playwright/test';
import { createCollection } from '../../helpers/collection';
import { loginAsTestUser } from '../../helpers/auth';
import { createOrg } from '../../helpers/org';
import { randomUUID } from 'crypto';

test.describe('Collection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should create a user collection', async ({ page }) => {
    const slugName = `user-coll-${randomUUID()}`;
    const createdSlug = await createCollection(page, { type: 'user' }, { name: 'My Collection', slug: slugName, visibility: 'public' });
    await expect(page).toHaveURL(new RegExp(`/users/.*/c/${createdSlug}$`));
    await expect(page.locator('h1')).toContainText('My Collection');
  });

  test('should create an org collection', async ({ page }) => {
    const orgSlug = `test-org-${randomUUID().slice(0, 8)}`;
    await createOrg(page, { name: 'Test Org', slug: orgSlug });

    const collSlug = `org-coll-${randomUUID().slice(0, 8)}`;
    const createdSlug = await createCollection(page, { type: 'org', orgSlug: orgSlug }, { name: 'My Org Collection', slug: collSlug, visibility: 'public' });
    await expect(page).toHaveURL(new RegExp(`/orgs/.*/c/${createdSlug}$`));
    await expect(page.locator('h1')).toContainText('My Org Collection');
  });
});
