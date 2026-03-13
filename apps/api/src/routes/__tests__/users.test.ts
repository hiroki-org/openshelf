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

    it("PUT /api/users/me returns 404 when the user disappears after update", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/me",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ displayName: "Updated" }),
            },
            env as any,
        );

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "User not found" });
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
    });

    it("GET /api/users/search uses cache for identical queries", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        const users = [{ id: "user-2", name: "Alice", githubId: "alice" }];
        mockDb.select = vi.fn(() => makeQuery({ allResult: users }));

        const app = await createTestApp();
        const env = createTestEnv();

        // First request should hit database
        const res1 = await app.request(
            "http://localhost/api/users/search?q=ali",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );
        expect(res1.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(1);

        // Second identical request should use cache (database not called again)
        const res2 = await app.request(
            "http://localhost/api/users/search?q=ali",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );
        expect(res2.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(1); // Still 1, cache served second request

        const body2 = (await res2.json()) as any;
        expect(body2.users).toEqual(users);
    });

    it("GET /api/users/search skips cache for queries longer than MAX_CACHEABLE_QUERY_LENGTH", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        const users = [{ id: "user-2", name: "Bob", githubId: "bob" }];
        mockDb.select = vi.fn(() => makeQuery({ allResult: users }));

        const app = await createTestApp();
        const env = createTestEnv();

        // Long query that exceeds MAX_CACHEABLE_QUERY_LENGTH (128)
        const longQuery = "a".repeat(200);

        // First request with long query
        const res1 = await app.request(
            `http://localhost/api/users/search?q=${longQuery}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );
        expect(res1.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(1);

        // Second request with same long query should NOT use cache
        const res2 = await app.request(
            `http://localhost/api/users/search?q=${longQuery}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );
        expect(res2.status).toBe(200);
        expect(mockDb.select).toHaveBeenCalledTimes(2); // Database called twice, cache skipped
    });

    it("GET /api/users/search with query < 2 chars returns empty", async () => {
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
        const body = (await res.json()) as any;
        expect(body.users).toEqual([]);
    });

    it("GET /api/users/search without q param returns empty", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/users/search",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.users).toEqual([]);
    });
});
