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

    it("GET /api/users/search handles MAX_CACHE_SIZE limit", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "User1" });
        const app = await createTestApp();
        const env = { ...createTestEnv(), MAX_CACHE_SIZE: 2 }; // set max size to 2

        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "user-2", name: "Result 1" }] }));

        // 1st request
        await app.request("/api/users/search?q=limit0", { headers: { Authorization: `Bearer ${token}` } }, env as any);
        // 2nd request
        await app.request("/api/users/search?q=limit1", { headers: { Authorization: `Bearer ${token}` } }, env as any);
        // 3rd request, triggers eviction of 1st request
        await app.request("/api/users/search?q=limit2", { headers: { Authorization: `Bearer ${token}` } }, env as any);
        
        expect(mockDb.select).toHaveBeenCalledTimes(3);

        // re-request 1st query, it should hit DB again (evicted)
        const finalReq = await app.request("/api/users/search?q=limit0", { headers: { Authorization: `Bearer ${token}` } }, env as any);
        expect(finalReq.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(4); // 4th DB hit proves eviction
    });

    it("GET /api/users/:id returns 404 when the user does not exist (covered missed line 154)", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));
        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request("/api/users/missing-user", {}, env as any);
        expect(res.status).toBe(404);
    });

});
