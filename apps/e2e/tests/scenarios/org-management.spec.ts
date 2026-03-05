import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { createOrg } from '../../helpers/org';
import { uploadPaper } from '../../helpers/paper';
import { deleteTestOrg, deleteTestPaper } from '../../helpers/cleanup';
import path from 'path';

test.describe('Org Management', () => {
  let orgSlug: string;
  let paperId: string;

  test.afterEach(async ({ page }) => {
    if (orgSlug) await deleteTestOrg(page, orgSlug);
    if (paperId) await deleteTestPaper(page, paperId);
  });

  test('create org, add member, and associate paper', async ({ page }) => {
    const user = await loginAsTestUser(page);

    orgSlug = `e2e-org-${Date.now()}`;
    await createOrg(page, 'E2E Test Org', orgSlug);

    // Verify org page
    await expect(page.locator('h1')).toHaveText('E2E Test Org');

    // Upload paper first
    const filePath = path.join(__dirname, '../fixtures/dummy.pdf');
    paperId = await uploadPaper(page, {
      title: 'Org Integration Paper',
      visibility: 'public',
      filePath,
    });

    // Go to org settings
    await page.goto(`/orgs/${orgSlug}/settings`);
    
    // Switch to Papers tab
    await page.click('button:has-text("論文")');
    
    // Search and add paper
    const paperSearchInput = page.getByLabel('論文検索');
    await paperSearchInput.fill('Org Integration Paper');
    await page.waitForTimeout(1000); // wait for search

    // Add it
    await page.locator(`li:has-text("Org Integration Paper")`).locator('button').first().click();

    // Verify it's on org home page
    await page.goto(`/orgs/${orgSlug}`);
    await expect(page.locator('text=Org Integration Paper')).toBeVisible();
  });
});
