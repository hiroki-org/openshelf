import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createExpiredJWT,
    createTestApp,
    createTestEnv,
    createTestJWT,
    createMockD1,
    makeQuery,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb)
}));

describe("auth routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({
                values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(async () => undefined) }))
            }))
        };
    });

    it("GET /api/auth/github redirects with client_id and oauth_state cookie", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/api/auth/github", {}, env as any);

        expect(res.status).toBe(302);
        const location = res.headers.get("location") ?? "";
        expect(location).toContain("https://github.com/login/oauth/authorize?");
        expect(location).toContain("client_id=test-client-id");

        const setCookie = res.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("oauth_state=");
    });

    it("GET /api/auth/github/callback returns frontend redirect with JWT", async () => {
        const { db, withSession } = createMockD1({
            sessionHandler: (query) => {
                if (query.includes("INSERT INTO users")) {
                    return {
                        run: async () => ({ results: [] }),
                    };
                }
                if (query.includes("SELECT id")) {
                    return {
                        first: async () => ({ id: "user-1" }),
                    };
                }
            },
        });

        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ access_token: "gh-token" })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ id: 123, login: "octocat", name: "Octo Cat", avatar_url: "http://avatar", email: "octo@example.com" })
                })
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: db });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_state=good-state"
                }
            },
            env as any
        );

        expect(res.status).toBe(302);
        const location = res.headers.get("location") ?? "";
        expect(location).toContain("http://localhost:3000/auth/callback#token=");
        expect(res.headers.get("set-cookie") ?? "").toContain("oauth_state=");
        expect(withSession).toHaveBeenCalledWith("first-primary");
    });

    it("GET /api/auth/github/callback returns 400 for invalid state", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=bad-state",
            {
                headers: {
                    Cookie: "oauth_state=good-state"
                }
            },
            env as any
        );

        expect(res.status).toBe(400);
    });

    it("GET /api/auth/github/callback returns controlled 500 when user persistence fails", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { db } = createMockD1({
            sessionHandler: (query) => {
                if (query.includes("INSERT INTO users")) {
                    return {
                        run: async () => {
                            throw new Error("D1 unavailable");
                        },
                    };
                }
            },
            dbHandler: (query) => {
                if (query === "PRAGMA table_info(users)") {
                    return {
                        all: async () => ({
                            results: [
                                { name: "id" },
                                { name: "github_id" },
                                { name: "name" },
                                { name: "avatar_url" },
                                { name: "email" },
                                { name: "created_at" },
                                { name: "updated_at" },
                            ],
                        }),
                    };
                }
                if (query === "PRAGMA index_list(users)") {
                    return {
                        all: async () => ({
                            results: [{ name: "users_github_id_unique", unique: 1 }],
                        }),
                    };
                }
                if (query.includes('PRAGMA index_info("users_github_id_unique")')) {
                    return {
                        all: async () => ({
                            results: [{ name: "github_id" }],
                        }),
                    };
                }
            },
        });

        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ access_token: "gh-token" })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ id: 123, login: "octocat", name: "Octo Cat" })
                })
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: db });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_state=good-state"
                }
            },
            env as any
        );

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Failed to persist GitHub user" });
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("GET /api/auth/me returns 200 for valid Bearer token", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "user-1", name: "Tester" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/auth/me",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.user.id).toBe("user-1");
    });

    it("GET /api/auth/me returns 401 when token is missing", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/api/auth/me", {}, env as any);
        expect(res.status).toBe(401);
    });

    it("GET /api/auth/me returns 401 when token is invalid", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/auth/me",
            {
                headers: {
                    Authorization: "Bearer invalid-token"
                }
            },
            env as any
        );

        expect(res.status).toBe(401);
    });

    it("GET /api/auth/me returns 401 when token is expired", async () => {
        const token = await createExpiredJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/auth/me",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            },
            env as any
        );

        expect(res.status).toBe(401);
    });
});
