import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  issueTestToken,
  apiURL,
  testAuthSecret,
  testOrigin,
} from '../../helpers/auth';

test.describe('Backend Auth E2E', () => {
  test('test-token endpoint rejects requests without shared secret', async ({
    request,
  }) => {
    const res = await request.post(`${apiURL}/api/test-auth/test-token`, {
      data: {
        sub: randomUUID(),
        githubId: randomUUID(),
        name: 'No Secret User',
      },
      headers: {
        origin: testOrigin,
        referer: testOrigin,
      },
    });

    expect(res.status()).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Unauthorized (E2E)',
    });
  });

  test('test-token endpoint validates request body', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/test-auth/test-token`, {
      data: {
        sub: randomUUID(),
        githubId: randomUUID(),
      },
      headers: {
        'x-test-auth-secret': testAuthSecret,
        origin: testOrigin,
        referer: testOrigin,
      },
    });

    expect(res.status()).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Invalid request body',
    });
  });

  test('issued test token authenticates /api/users/me', async ({ request }) => {
    const uniqueSuffix = randomUUID().slice(0, 8);
    const { token, payload } = await issueTestToken(request, {
      name: `backend-e2e-${uniqueSuffix}`,
    });

    const res = await request.get(`${apiURL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status()).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      user: {
        id: payload.sub,
        githubId: payload.githubId,
        name: payload.name,
      },
    });
  });

  test('test-org endpoint rejects requests without shared secret', async ({
    request,
  }) => {
    const unauthorizedRes = await request.post(`${apiURL}/api/test-auth/test-org`, {
      data: {
        userId: randomUUID(),
        orgId: randomUUID(),
      },
      headers: {
        origin: testOrigin,
        referer: testOrigin,
      },
    });
    expect(unauthorizedRes.status()).toBe(401);
    await expect(unauthorizedRes.json()).resolves.toMatchObject({
      error: 'Unauthorized (E2E)',
    });
  });

  test('test-org endpoint validates payload', async ({ request }) => {
    const { payload } = await issueTestToken(request, {
      name: `org-member-${randomUUID().slice(0, 8)}`,
    });

    const invalidRes = await request.post(`${apiURL}/api/test-auth/test-org`, {
      data: {
        userId: payload.sub,
      },
      headers: {
        'x-test-auth-secret': testAuthSecret,
        origin: testOrigin,
        referer: testOrigin,
      },
    });
    expect(invalidRes.status()).toBe(400);
    await expect(invalidRes.json()).resolves.toMatchObject({
      error: 'userId and orgId are required',
    });
  });

  test('test-org endpoint creates membership with valid payload', async ({
    request,
  }) => {
    const { payload } = await issueTestToken(request, {
      name: `org-member-${randomUUID().slice(0, 8)}`,
    });

    const validRes = await request.post(`${apiURL}/api/test-auth/test-org`, {
      data: {
        userId: payload.sub,
        orgId: randomUUID(),
      },
      headers: {
        'x-test-auth-secret': testAuthSecret,
        origin: testOrigin,
        referer: testOrigin,
      },
    });
    expect(validRes.status()).toBe(200);
    await expect(validRes.json()).resolves.toMatchObject({ ok: true });
  });
});
