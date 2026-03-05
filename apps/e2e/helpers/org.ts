import { Page } from '@playwright/test';

export async function createOrg(page: Page, name: string, slug: string): Promise<string> {
  await page.goto('/orgs/new');
  await page.fill('#org-name', name);
  await page.fill('#org-slug', slug);
  await page.waitForTimeout(500); // Wait for slug validation API
  await page.click('button[type="submit"]');
  await page.waitForURL(new RegExp('/orgs/.+'));
  return slug;
}
