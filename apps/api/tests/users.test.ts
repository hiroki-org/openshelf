import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';

// Mock auth middleware before importing users route
vi.mock('../src/middleware/auth', () => ({
    authMiddleware: async (c: Context, next: Next) => {
        c.set('user', { sub: 'user_123' });
        await next();
    }
}));

import usersRoute from '../src/routes/users';

describe('Users API - Missing Error Path Test', () => {
    describe('PATCH /api/users/me', () => {
        it('should return 400 with "Invalid JSON body" error for malformed JSON request', async () => {
            const app = new Hono();
            app.route('/api/users', usersRoute);

            // Create a request with malformed JSON body
            const req = new Request('http://localhost/api/users/me', {
                method: 'PATCH',
                body: '{ "displayName": "New Name", ', // Missing closing brace
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const res = await app.request(req);

            // Assert status code is 400 Bad Request
            expect(res.status).toBe(400);

            // Assert error message is correct
            const body = await res.json();
            expect(body).toEqual({ error: "Invalid JSON body" });
        });
    });
});
