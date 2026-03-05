import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { createOrg } from '../../helpers/org';
import { uploadPaper } from '../../helpers/paper';
import { createCollection } from '../../helpers/collection';
import { deleteTestOrg, deleteTestPaper, deleteTestCollection } from '../../helpers/cleanup';
import path from 'path';

test.describe('Cross Feature Full Flow', () => {
    let orgSlug: string;
    let collectionSlug: string;
    let paperId: string;

    test.afterEach(async ({ page }) => {
        if (orgSlug) await deleteTestOrg(page, orgSlug);
        if (collectionSlug) await deleteTestCollection(page, collectionSlug);
        if (paperId) await deleteTestPaper(page, paperId);
    });

    test('Full e2e flow from auth to OG image validation', async ({ page }) => {
        await loginAsTestUser(page);

        // 1. Org creation
        orgSlug = `e2e-cross-${Date.now()}`;
        await createOrg(page, 'Cross Feature Org', orgSlug);

        // 2. Paper upload
        const filePath = path.join(__dirname, '../fixtures/dummy.pdf');
        paperId = await uploadPaper(page, {
            title: 'Cross Feature Paper',
            visibility: 'public',
            filePath,
        });

        // 3. Associate paper to org
        const jwt = await page.evaluate(() => localStorage.getItem('auth_token'));
        await page.request.post(`${process.env.E2E_API_URL || 'http://localhost:8787'}/api/orgs/${orgSlug}/papers`, {
            headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
            data: { paperId }
        });

        // 4. Create collection
        collectionSlug = 'cross-collection';
        await createCollection(page, orgSlug, 'Cross Collection');

        // 5. Add paper to collection
        const res = await page.request.get(`${process.env.E2E_API_URL || 'http://localhost:8787'}/api/orgs/${orgSlug}/collections`);
        if (res.ok()) {
            const data = await res.json();
            const c = data.collections.find((x: any) => x.slug === collectionSlug);

            if (c) {
                await page.request.post(`${process.env.E2E_API_URL || 'http://localhost:8787'}/api/collections/${c.id}/items`, {
                    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
                    data: { paperId }
                });
            }
        }

        // 6. Verify paper in collection page
        await page.goto(`/orgs/${orgSlug}/c/${collectionSlug}`);
        await expect(page.locator(`text=Cross Feature Paper`)).toBeVisible();

        // 7. OG tag validations
        await page.goto(`/papers/${paperId}`);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Cross Feature Paper/);
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/api\/og\?.*type=paper/);

        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Cross Feature Org/);
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/api\/og\?.*type=org/);

        await page.goto(`/orgs/${orgSlug}/c/${collectionSlug}`);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Cross Collection/);
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/api\/og\?.*type=collection/);
    });
});
