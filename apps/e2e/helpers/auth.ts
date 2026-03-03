import { Page } from '@playwright/test';
import { randomUUID } from 'crypto';

const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';

export async function loginAsTestUser(page: Page, user?: { sub?: string; githubId?: string; name?: string }) {
    const payload = {
        sub: user?.sub || randomUUID(),
        githubId: user?.githubId || randomUUID(),
        name: user?.name || 'Test User',
    };

    const res = await page.request.post(`${apiURL}/api/auth/test-token`, {
        data: payload,
        headers: {
            'x-test-auth-secret': process.env.TEST_AUTH_SECRET || 'e2e-ci-only-secret'
        }
    });

    if (!res.ok()) {
        throw new Error(`Failed to get test token: ${await res.text()}`);
    }

    const data = await res.json();
    if (
        !data ||
        typeof data !== 'object' ||
        typeof (data as { token?: unknown }).token !== 'string' ||
        (data as { token: string }).token.length === 0
    ) {
        throw new Error('Invalid token response from /api/auth/test-token');
    }
    const token = (data as { token: string }).token;

    // Go to home first so that we have a trusted origin to set localStorage on
    await page.goto('/');

    await page.evaluate((jwt) => {
        localStorage.setItem('auth_token', jwt);
    }, token);

    await page.reload();

    return payload;
}
