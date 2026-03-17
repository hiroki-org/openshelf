import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    createTestEnv,
    createTestJWT,
    makeQuery,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb)
}));

describe("users routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            update: vi.fn(() => ({
                set: vi.fn(() => ({ where: vi.fn(async () => undefined) }))
            }))
        };
    });

    it("GET /api/users/me returns profile for authenticated user", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "user-1", name: "Tester" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/me",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.user.id).toBe("user-1");
    });

    it("PUT /api/users/me updates display_name", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "user-1", name: "Tester", displayName: "Updated" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/me",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ displayName: "Updated" })
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.user.displayName).toBe("Updated");
    });

    it("PATCH /api/users/me with malformed JSON returns 400", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/me",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: '{ "displayName": "New Name", ' // Missing closing brace
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toBe("Invalid JSON body");
    });

    it("GET /api/users/search?q=... returns search results", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "user-2", name: "Alice", githubId: "alice" }] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/search?q=ali",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.users).toHaveLength(1);
        expect(body.users[0].name).toBe("Alice");

        // Second request should hit cache (mockDb.select should not be called again)
        const res2 = await app.request(
            "http://localhost/api/users/search?q=ali",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );
        expect(res2.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("PATCH /api/users/me rejects non-string display names", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/me",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ displayName: 123 })
            },
            env as any
        );

        expect(res.status).toBe(400);
        expect(((await res.json()) as any).error).toBe("displayName must be a string or null");
    });

    it("PATCH /api/users/me trims blank display names to null", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        const setValues = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
        mockDb.update = vi.fn(() => ({ set: setValues }));
        mockDb.select = vi.fn(() =>
            makeQuery({ getResult: { id: "user-1", name: "Tester", displayName: null } }),
        );

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/me",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ displayName: "   " })
            },
            env as any
        );

        expect(res.status).toBe(200);
        expect(setValues).toHaveBeenCalledWith({ displayName: null });
    });

    it("GET /api/users/search returns cached results on repeat queries", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() =>
            makeQuery({ allResult: [{ id: "user-2", name: "Alice", githubId: "alice" }] }),
        );

        const app = await createTestApp();
        const env = createTestEnv();

        const first = await app.request(
            "http://localhost/api/users/search?q=ali",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );
        expect(first.status).toBe(200);

        const second = await app.request(
            "http://localhost/api/users/search?q=ali",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(second.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("GET /api/users/search returns an empty list for short queries", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/search?q=a",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(res.status).toBe(200);
        expect(((await res.json()) as any).users).toEqual([]);
        expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("GET /api/users/:id returns 404 when the user does not exist", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/missing",
            {},
            env as any
        );

        expect(res.status).toBe(404);
        expect(((await res.json()) as any).error).toBe("User not found");
    });

    it("GET /api/users/search handles cache eviction when key exists but expired", async () => {
        vi.useFakeTimers();
        try {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "User1" });
            const app = await createTestApp();
            const env = createTestEnv();

            mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "user-2", name: "Result 1" }] }));

            // Initial request caches it
            await app.request("/api/users/search?q=testevict", { headers: { Authorization: `Bearer ${token}` } }, env as any);

            // Advance time to expire the cache
            vi.setSystemTime(Date.now() + 61 * 1000);

            // This request will find cache expired, query DB again, and then call setCachedResults which hits `if (searchCache.has(key))`
            const res = await app.request("/api/users/search?q=testevict", { headers: { Authorization: `Bearer ${token}` } }, env as any);

            expect(res.status).toBe(200);
            expect(mockDb.select).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("GET /api/users/search LRU: accessing a cached entry moves it to end and protects it from eviction", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "User1" });
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "user-2", name: "Result" }] }));

        const smallEnv = { ...env, MAX_CACHE_SIZE: 3 } as any;

        // Fill cache to capacity with 3 distinct queries (limit0, limit1, limit2)
        for (let i = 0; i < 3; i++) {
            await app.request(`/api/users/search?q=lru${i}`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv);
        }
        const selectCallsAfterFill = mockDb.select.mock.calls.length;

        // Access lru0 again — this should move it to end (LRU touch), making lru1 the oldest
        await app.request(`/api/users/search?q=lru0`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv);
        // lru0 was cached so no new DB call
        expect(mockDb.select.mock.calls.length).toBe(selectCallsAfterFill);

        // Add a new entry — this should evict lru1 (the new oldest), not lru0
        await app.request(`/api/users/search?q=lrunew`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv);

        // lru0 should still be cached (no new DB call)
        await app.request(`/api/users/search?q=lru0`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv);
        expect(mockDb.select.mock.calls.length).toBe(selectCallsAfterFill + 1); // only lrunew caused a DB call

        // lru1 should have been evicted (causes a new DB call)
        const selectBeforeLru1 = mockDb.select.mock.calls.length;
        await app.request(`/api/users/search?q=lru1`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv);
        expect(mockDb.select.mock.calls.length).toBe(selectBeforeLru1 + 1);
    });

    it("GET /api/users/search setCachedResults does not evict another entry when updating an existing key", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "User1" });
        const app = await createTestApp();

        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "user-2", name: "Result" }] }));

        // Use MAX_CACHE_SIZE=2 so we can easily check eviction
        const smallEnv = createTestEnv();
        const tinyEnv = { ...smallEnv, MAX_CACHE_SIZE: 2 } as any;

        // Fill cache: key "aa" and "bb"
        await app.request(`/api/users/search?q=aa`, { headers: { Authorization: `Bearer ${token}` } }, tinyEnv);
        await app.request(`/api/users/search?q=bb`, { headers: { Authorization: `Bearer ${token}` } }, tinyEnv);
        const callsAfterFill = mockDb.select.mock.calls.length; // 2

        // Re-query "aa" — triggers getCachedResults (cache hit, LRU touch), no DB call
        await app.request(`/api/users/search?q=aa`, { headers: { Authorization: `Bearer ${token}` } }, tinyEnv);
        expect(mockDb.select.mock.calls.length).toBe(callsAfterFill);

        // Expire "aa" so the next request re-fetches and calls setCachedResults with existing key
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 61 * 1000);
        await app.request(`/api/users/search?q=aa`, { headers: { Authorization: `Bearer ${token}` } }, tinyEnv);
        vi.useRealTimers();

        // One new DB call for the expired re-fetch of "aa"
        expect(mockDb.select.mock.calls.length).toBe(callsAfterFill + 1);

        // "bb" should still be in cache (no eviction occurred because "aa" was an update, not a new entry)
        await app.request(`/api/users/search?q=bb`, { headers: { Authorization: `Bearer ${token}` } }, tinyEnv);
        expect(mockDb.select.mock.calls.length).toBe(callsAfterFill + 1);
    });

    it("GET /api/users/search handles MAX_CACHE_SIZE limit", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "User1" });
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "user-2", name: "Result 1" }] }));

        // We send 1002 requests with unique queries to hit the limit
        // (Wait, sending 1000 requests might be slow. Is there a better way? Let's just do it in a Promise.all or similar)
        // Alternatively, we can test MAX_CACHE_SIZE by exporting it in test. Since we can't easily, we'll just loop.
        const smallEnv = { ...env, MAX_CACHE_SIZE: 3 } as any;

        const reqs = [];
        for (let i = 0; i < 3; i++) {
            reqs.push(app.request(`/api/users/search?q=limit${i}`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv));
        }
        await Promise.all(reqs);

        const callCountAfterFill = mockDb.select.mock.calls.length;

        // trigger eviction
        await app.request("/api/users/search?q=limittrigger", { headers: { Authorization: `Bearer ${token}` } }, smallEnv);

        // request oldest cached query again
        await app.request(`/api/users/search?q=limit0`, { headers: { Authorization: `Bearer ${token}` } }, smallEnv);

        expect(mockDb.select.mock.calls.length).toBeGreaterThan(callCountAfterFill + 1);
    });


});