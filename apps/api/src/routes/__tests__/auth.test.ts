import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createExpiredJWT,
    createTestApp,
    createTestEnv,
    createTestJWT,
    makeQuery,
} from "../../test/helpers";

let mockDb: any;

type OAuthStateEntry = {
    createdAt: string;
    browserNonce: string;
};

function createOAuthStateDb(initialStates: Record<string, OAuthStateEntry> = {}) {
    const states = new Map<string, OAuthStateEntry>(Object.entries(initialStates));

    const db = {
        prepare: vi.fn((sql: string) => ({
            run: async () => {
                if (
                    sql.startsWith(
                        "DELETE FROM oauth_states WHERE created_at <= datetime('now', '-5 minutes')",
                    )
                ) {
                    const now = Date.now();
                    for (const [state, row] of states.entries()) {
                        const createdAt = new Date(`${row.createdAt}Z`);
                        if (now - createdAt.getTime() > 5 * 60 * 1000) {
                            states.delete(state);
                        }
                    }
                }
                return {};
            },
            bind: (...args: unknown[]) => {
                if (
                    sql.startsWith(
                        "INSERT INTO oauth_states (state, browser_nonce) VALUES (?, ?)",
                    )
                ) {
                    return {
                        run: async () => {
                            const state = String(args[0] ?? "");
                            const browserNonce = String(args[1] ?? "");
                            const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
                            states.set(state, { createdAt, browserNonce });
                            return {};
                        },
                    };
                }

                if (
                    sql.startsWith(
                        "DELETE FROM oauth_states WHERE state = ? AND browser_nonce = ? RETURNING created_at",
                    )
                ) {
                    return {
                        first: async <T>() => {
                            const state = String(args[0] ?? "");
                            const browserNonce = String(args[1] ?? "");
                            const stateRow = states.get(state);
                            if (!stateRow || stateRow.browserNonce !== browserNonce) return null;
                            states.delete(state);
                            return { created_at: stateRow.createdAt } as T;
                        },
                    };
                }

                return {
                    run: async () => ({}),
                    first: async () => null,
                };
            }
        }))
    };

    return { db, states };
}

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
                values: vi.fn(() => ({
                    onConflictDoUpdate: vi.fn(async () => undefined),
                }))
            })),
        };
    });

    it("GET /api/auth/github persists state in D1 and redirects with client_id", async () => {
        const app = await createTestApp();
        const oauthStateDb = createOAuthStateDb();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request("http://localhost/api/auth/github", {}, env as any);

        expect(res.status).toBe(302);
        const location = res.headers.get("location") ?? "";
        expect(location).toContain("https://github.com/login/oauth/authorize?");
        expect(location).toContain("client_id=test-client-id");

        const state = new URL(location).searchParams.get("state");
        expect(state).toBeTruthy();
        expect(state ? oauthStateDb.states.has(state) : false).toBe(true);
        const setCookie = res.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("oauth_flow_nonce=");
        expect(setCookie).toContain("HttpOnly");
        expect(state ? oauthStateDb.states.get(state)?.browserNonce : null).toBeTruthy();
    });

    it("GET /api/auth/github/callback returns 400 when state does not exist in D1", async () => {
        const app = await createTestApp();
        const oauthStateDb = createOAuthStateDb();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=missing-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=nonce-1",
                },
            },
            env as any
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "Invalid or expired state" });
    });

    it("GET /api/auth/github/callback returns 400 when state parameter is missing", async () => {
        const app = await createTestApp();
        const env = createTestEnv({ DB: createOAuthStateDb().db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=nonce-1",
                },
            },
            env as any,
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "Missing state parameter" });
    });

    it("GET /api/auth/github/callback returns 400 when OAuth flow cookie is missing", async () => {
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "cookie-state": {
                createdAt: nowState,
                browserNonce: "cookie-nonce",
            },
        });
        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=cookie-state",
            {},
            env as any
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "Missing OAuth flow cookie" });
        expect(oauthStateDb.states.has("cookie-state")).toBe(true);
    });

    it("GET /api/auth/github/callback returns 400 when state is expired", async () => {
        const expiredAt = new Date(Date.now() - 6 * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "expired-state": {
                createdAt: expiredAt,
                browserNonce: "expired-nonce",
            },
        });
        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=expired-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=expired-nonce",
                },
            },
            env as any
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "State expired" });
        expect(oauthStateDb.states.has("expired-state")).toBe(false);
    });

    it("GET /api/auth/github/callback returns 400 when code is missing", async () => {
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
            },
        });
        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any,
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "Missing code parameter" });
    });

    it("GET /api/auth/github/callback returns frontend redirect with JWT for valid state", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "user-1" } }));

        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
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
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any
        );

        expect(res.status).toBe(302);
        const location = res.headers.get("location") ?? "";
        expect(location).toContain("http://localhost:3000/auth/callback#token=");
        expect(oauthStateDb.states.has("good-state")).toBe(false);
    });

    it("GET /api/auth/github/callback returns 502 when OAuth token exchange fails", async () => {
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
            },
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                text: async () => "bad token exchange",
            }),
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any,
        );

        expect(res.status).toBe(502);
        await expect(res.json()).resolves.toEqual({
            error: "Failed to exchange OAuth code",
            details: "bad token exchange",
        });
    });

    it("GET /api/auth/github/callback returns 400 when GitHub does not return an access token", async () => {
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
            },
        });
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ token_type: "bearer" }),
            }),
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any,
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "Failed to get access token" });
    });

    it("GET /api/auth/github/callback returns 502 when fetching the GitHub user fails", async () => {
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
            },
        });
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ access_token: "gh-token" }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    text: async () => "bad user payload",
                }),
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any,
        );

        expect(res.status).toBe(502);
        await expect(res.json()).resolves.toEqual({
            error: "Failed to fetch GitHub user",
            details: "bad user payload",
        });
    });

    it("GET /api/auth/github/callback returns 502 for invalid GitHub user payloads", async () => {
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
            },
        });
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ access_token: "gh-token" }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ id: "abc", login: 123 }),
                }),
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any,
        );

        expect(res.status).toBe(502);
        await expect(res.json()).resolves.toEqual({ error: "Invalid GitHub user payload" });
    });

    it("GET /api/auth/github/callback returns 500 when FRONTEND_URL is missing", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "user-1" } }));

        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "good-state": {
                createdAt: nowState,
                browserNonce: "good-nonce",
            },
        });

        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ access_token: "gh-token" }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ id: 123, login: "octocat", name: "Octo Cat" }),
                }),
        );

        const app = await createTestApp();
        const env = createTestEnv({
            DB: oauthStateDb.db as any,
            FRONTEND_URL: "",
        });

        const res = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=good-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=good-nonce",
                },
            },
            env as any,
        );

        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({ error: "Server configuration error" });
    });

    it("GET /api/auth/github/callback rejects replayed state on second use", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "user-1" } }));

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

        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({
            "replay-state": {
                createdAt: nowState,
                browserNonce: "replay-nonce",
            },
        });
        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });

        const firstRes = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=replay-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=replay-nonce",
                },
            },
            env as any
        );
        expect(firstRes.status).toBe(302);

        const secondRes = await app.request(
            "http://localhost/api/auth/github/callback?code=code123&state=replay-state",
            {
                headers: {
                    Cookie: "oauth_flow_nonce=replay-nonce",
                },
            },
            env as any
        );

        expect(secondRes.status).toBe(400);
        await expect(secondRes.json()).resolves.toEqual({ error: "Invalid or expired state" });
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

    it("GET /api/auth/me returns 404 when the user does not exist", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/auth/me",
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            env as any,
        );

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "User not found" });
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

    it("POST /api/auth/logout returns ok", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    Origin: "http://localhost:3000",
                },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("POST /api/test-auth/test-token returns 404 when test auth is disabled", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    Origin: "http://localhost:3000",
                },
            },
            env as any,
        );

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "Not Found" });
    });

    it("POST /api/test-auth/test-token validates the shared secret and request body", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "shared-secret",
        });

        const unauthorized = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                },
                body: JSON.stringify({ sub: "user-1", githubId: "123", name: "Tester" }),
            },
            env as any,
        );
        expect(unauthorized.status).toBe(401);

        const invalidJson = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                    Origin: "http://localhost:3000",
                },
                body: "{",
            },
            env as any,
        );
        expect(invalidJson.status).toBe(400);
        await expect(invalidJson.json()).resolves.toEqual({ error: "Invalid JSON" });

        const invalidBody = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                    Origin: "http://localhost:3000",
                },
                body: JSON.stringify({ sub: "user-1" }),
            },
            env as any,
        );
        expect(invalidBody.status).toBe(400);
        await expect(invalidBody.json()).resolves.toEqual({ error: "Invalid request body" });
    });

    it("POST /api/test-auth/test-token upserts the user and returns a signed JWT", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "persisted-user" } }));

        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "shared-secret",
        });

        const res = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                },
                body: JSON.stringify({
                    sub: "user-1",
                    githubId: "123",
                    name: "Tester",
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as { token: string };
        expect(body.token).toMatch(/\./);
        });

        it("POST /api/test-auth/test-token returns 500 if user persistence fails", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "shared-secret",
        });

        const res = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                },
                body: JSON.stringify({ sub: "u1", githubId: "g1", name: "N" }),
            },
            env as any
        );
        expect(res.status).toBe(500);
        });

        it("GET /api/auth/github/callback uses login as name if GitHub name is missing", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "user-1" } }));
        const nowState = new Date().toISOString().replace("T", " ").slice(0, 19);
        const oauthStateDb = createOAuthStateDb({ "s1": { createdAt: nowState, browserNonce: "n1" } });

        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t" }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, login: "userlogin", name: "" }) })
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: oauthStateDb.db as any });
        const res = await app.request("http://localhost/api/auth/github/callback?code=c&state=s1", {
            headers: { Cookie: "oauth_flow_nonce=n1" }
        }, env as any);
        expect(res.status).toBe(302);
        });

        it("POST /api/test-auth/test-org returns 404 or 401 based on configuration", async () => {
        const app = await createTestApp();
        const res404 = await app.request("http://localhost/api/test-auth/test-org", {
            method: "POST",
            headers: { Origin: "http://localhost:3000" }
        }, createTestEnv({ ENABLE_TEST_AUTH: "false" }) as any);
        expect(res404.status).toBe(404);

        const res401 = await app.request("http://localhost/api/test-auth/test-org", {
            method: "POST",
            headers: {
                Origin: "http://localhost:3000",
                "x-test-auth-secret": "wrong"
            }
        }, createTestEnv({ ENABLE_TEST_AUTH: "true", TEST_AUTH_SECRET: "secret" }) as any);
        expect(res401.status).toBe(401);
    });

    it("POST /api/test-auth/test-org validates auth and creates membership records", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "shared-secret",
        });

        const invalidJson = await app.request(
            "http://localhost/api/test-auth/test-org",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                },
                body: "{",
            },
            env as any,
        );
        expect(invalidJson.status).toBe(400);

        const invalidBody = await app.request(
            "http://localhost/api/test-auth/test-org",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                },
                body: JSON.stringify({ userId: "user-1" }),
            },
            env as any,
        );
        expect(invalidBody.status).toBe(400);
        await expect(invalidBody.json()).resolves.toEqual({
            error: "userId and orgId are required",
        });

        const onConflictDoNothing = vi.fn(async () => undefined);
        mockDb.insert = vi.fn(() => ({
            values: vi.fn(() => ({
                onConflictDoNothing,
            })),
        }));

        const ok = await app.request(
            "http://localhost/api/test-auth/test-org",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-auth-secret": "shared-secret",
                },
                body: JSON.stringify({ userId: "user-1", orgId: "org-1" }),
            },
            env as any,
        );
        expect(ok.status).toBe(200);
        await expect(ok.json()).resolves.toEqual({ ok: true });
        expect(onConflictDoNothing).toHaveBeenCalled();
    });
});
