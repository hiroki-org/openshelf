import { Page } from '@playwright/test';

export async function createCollection(page: Page, orgSlug: string, name: string): Promise<string> {
  await page.goto('/collections/new');
  if (orgSlug) {
    // Select the "org" radio button by checking its label
    await page.getByLabel('org', { exact: true }).check();
    await page.fill('#orgSlug', orgSlug);
  } else {
    await page.getByLabel('user', { exact: true }).check();
  }
  
  await page.fill('#name', name);
  
  // Wait for slug checking
  await page.waitForTimeout(500);
  
  await page.click('button[type="submit"]');
  
  // URL changes to /orgs/:orgSlug/c/:slug or /users/:id/c/:slug
  await page.waitForURL(/\/c\/.+/);
  
  const parts = page.url().split('/');
  return parts[parts.length - 1];
}
