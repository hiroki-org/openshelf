import { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'crypto';

export const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';
export const testAuthSecret = process.env.TEST_AUTH_SECRET || 'test-secret';
export const testOrigin = process.env.E2E_BASE_URL || 'http://localhost:3000';

type TestUserInput = {
  sub?: string;
  githubId?: string;
  name?: string;
};

export async function issueTestToken(
  request: APIRequestContext,
  user?: TestUserInput,
): Promise<{ token: string; payload: Required<TestUserInput> }> {
  const payload: Required<TestUserInput> = {
    sub: user?.sub || randomUUID(),
    githubId: user?.githubId || randomUUID(),
    name: user?.name || 'Test User',
  };

  const res = await request.post(`${apiURL}/api/test-auth/test-token`, {
    data: payload,
    headers: {
      'x-test-auth-secret': testAuthSecret,
      origin: testOrigin,
      referer: testOrigin,
    },
  });

  if (!res.ok()) {
    throw new Error(`Failed to get test token: ${await res.text()}`);
  }

  const data = await res.json();
  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as { token?: unknown }).token !== 'string'
  ) {
    throw new Error(
      `Invalid token response from /api/test-auth/test-token: ${JSON.stringify(data)}`,
    );
  }
  const token = (data as { token: string }).token;
  if (token.length === 0) {
    throw new Error(
      'Invalid token response from /api/test-auth/test-token: empty token',
    );
  }

  return { token, payload };
}

export async function loginAsTestUser(page: Page, user?: TestUserInput) {
  const { token, payload } = await issueTestToken(page.request, user);

  await page.goto('/');
  await page.evaluate((jwt) => {
    localStorage.setItem('auth_token', jwt);
  }, token);
  await page.reload();

  return payload;
}
