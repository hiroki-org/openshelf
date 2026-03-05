import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import path from 'path';

test.describe('Security Checks', () => {
    const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';

    test('path traversal attempts are blocked', async ({ request }) => {
        // Attempt to fetch paper with path traversal
        const res = await request.get(`${apiURL}/api/papers/../../etc/passwd`);
        expect(res.status()).not.toBe(200);
        expect([400, 404]).toContain(res.status());
    });

    test('invalid MIME type upload via API is blocked', async ({ page }) => {
        const payload = await loginAsTestUser(page);
        const jwt = await page.evaluate(() => localStorage.getItem('auth_token'));

        // Mock a FormData request
        const res = await page.request.post(`${apiURL}/api/papers/upload`, {
            headers: { Authorization: `Bearer ${jwt}` },
            multipart: {
                "metadata": JSON.stringify({ title: "Bad file", visibility: "public" }),
                "files": {
                    name: "bad.exe",
                    mimeType: "application/x-msdownload",
                    buffer: Buffer.from("MZ"),
                }
            }
        });
        expect(res.status()).toBe(400);
    });

    test('authentication bypass is blocked', async ({ request }) => {
        // No Auth header
        const res = await request.post(`${apiURL}/api/papers`, {
            data: { title: "Hacked" }
        });
        // 401 or 403 due to CSRF / Auth
        expect([401, 403]).toContain(res.status());
    });

    test('OG route does not crash on prototype pollution attempt', async ({ request }) => {
        const res = await request.get(`${apiURL}/api/og?type=__proto__&title=test`);
        expect(res.status()).toBe(200); // Or 400 depending on exact implementation, but not 500
    });
});
