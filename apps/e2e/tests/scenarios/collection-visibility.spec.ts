import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { createCollection } from '../../helpers/collection';

test.describe('Collection Visibility', () => {
  test('privateなユーザーコレクションは他ユーザーから見えないこと', async ({
    page,
    browser,
  }) => {
    const owner = await loginAsTestUser(page, {
      name: `owner-${randomUUID().slice(0, 6)}`,
    });

    const collectionSlug = `private-${randomUUID().slice(0, 8)}`;
    const createdSlug = await createCollection(
      page,
      { type: 'user' },
      { name: 'Private Collection', slug: collectionSlug, visibility: 'private' },
    );

    await page.goto(`/users/${owner.sub}/c/${createdSlug}`);
    await expect(page.getByRole('heading', { name: 'Private Collection' })).toBeVisible();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await loginAsTestUser(guestPage, {
        name: `guest-${randomUUID().slice(0, 6)}`,
      });

      await guestPage.goto(`/users/${owner.sub}/c/${createdSlug}`);
      await expect(guestPage.getByText('コレクションが見つかりません')).toBeVisible();
    } finally {
      await guestContext.close();
    }
  });
});
