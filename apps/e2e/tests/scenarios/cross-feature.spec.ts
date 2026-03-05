import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { createOrg } from '../../helpers/org';
import { uploadPublicPaper } from '../../helpers/paper';
import { createCollection } from '../../helpers/collection';
import { generateTestCollectionName, generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('Cross Feature', () => {
    test('org + paper + collection flow', async ({ page }) => {
        await loginAsTestUser(page);

        const orgSlug = `cross-org-${randomUUID().slice(0, 8)}`;
        await createOrg(page, { name: 'Cross Org', slug: orgSlug });

        const paperTitle = generateTestPaperTitle();
        await uploadPublicPaper(page, paperTitle);

        await page.goto(`/orgs/${orgSlug}/settings`);
        await page.getByRole('button', { name: '論文' }).click();
        await page.getByPlaceholder(/論文タイトルで検索/).fill(paperTitle);
        await page.getByRole('button', { name: '追加' }).first().click();

        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.getByRole('link', { name: paperTitle })).toBeVisible();

        const collectionName = generateTestCollectionName();
        await createCollection(page, { type: 'org', orgSlug }, { name: collectionName, slug: `cross-col-${randomUUID().slice(0, 8)}`, visibility: 'public' });
        await expect(page).toHaveURL(/\/orgs\/.*\/c\/.+/);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(collectionName);
    });
});
