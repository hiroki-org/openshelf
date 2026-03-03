import { Page } from '@playwright/test';
import { randomUUID } from 'crypto';

const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';

export async function loginAsTestUser(page: Page, user?: { sub?: string; githubId?: string; name?: string }) {
    const payload = {
        sub: user?.sub || randomUUID(),
        githubId: user?.githubId || Math.floor(Math.random() * 100000).toString(),
        name: user?.name || 'Test User',
    };

    const res = await page.request.post(`${apiURL}/api/auth/test-token`, {
        data: payload
    });

    if (!res.ok()) {
        throw new Error(`Failed to get test token: ${await res.text()}`);
    }

    const { token } = await res.json();

    // Go to home first so that we have a trusted origin to set localStorage on
    await page.goto('/');

    await page.evaluate((jwt) => {
        localStorage.setItem('auth_token', jwt);
    }, token);

    await page.reload();

    return payload;
}
