import { Page, APIRequestContext } from '@playwright/test';

const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';

async function authRequest(page: Page, method: string, path: string) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  return page.request.fetch(`${apiURL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function deleteTestPaper(page: Page, id: string) {
  await authRequest(page, 'DELETE', `/api/papers/${id}`);
}

export async function deleteTestOrg(page: Page, slug: string) {
  await authRequest(page, 'DELETE', `/api/orgs/${slug}`);
}

export async function deleteTestCollection(page: Page, id: string) {
  await authRequest(page, 'DELETE', `/api/collections/${id}`);
}
