import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  issueTestToken,
  apiURL,
  testAuthSecret,
  testOrigin,
} from '../../helpers/auth';

const baseHeaders = {
  origin: testOrigin,
  referer: testOrigin,
};

const testAuthHeaders = {
  ...baseHeaders,
  'x-test-auth-secret': testAuthSecret,
};

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
      headers: baseHeaders,
    });

    expect(res.status()).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized (E2E)',
    });
  });

  test('test-token endpoint validates request body', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/test-auth/test-token`, {
      data: {
        sub: randomUUID(),
        githubId: randomUUID(),
      },
      headers: testAuthHeaders,
    });

    expect(res.status()).toBe(400);
    await expect(res.json()).resolves.toEqual({
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
    await expect(res.json()).resolves.toEqual({
      user: {
        id: payload.sub,
        githubId: payload.githubId,
        name: payload.name,
        displayName: null,
        avatarUrl: null,
        email: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
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
      headers: baseHeaders,
    });
    expect(unauthorizedRes.status()).toBe(401);
    await expect(unauthorizedRes.json()).resolves.toEqual({
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
      headers: testAuthHeaders,
    });
    expect(invalidRes.status()).toBe(400);
    await expect(invalidRes.json()).resolves.toEqual({
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
      headers: testAuthHeaders,
    });
    expect(validRes.status()).toBe(200);
    await expect(validRes.json()).resolves.toEqual({ ok: true });
  });
});
