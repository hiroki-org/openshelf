import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, createTestEnv, makeQuery } from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb)
}));

vi.mock("../../db/schema", () => ({
    users: { id: "id", githubId: "github_id" },
    orgs: { id: "id" },
    orgMembers: { orgId: "org_id" },
    enableForeignKeys: vi.fn(() => Promise.resolve()),
    touchUpdatedAt: vi.fn(() => ({})),
}));

describe("CORS configuration", () => {
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

    it("uses FRONTEND_URL as fallback when ALLOWED_ORIGINS is not set", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: { prepare: vi.fn(() => ({ run: vi.fn(), bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn(() => null) })) })) },
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: undefined
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                headers: {
                    Origin: "https://frontend.example.com"
                }
            },
            env as any
        );

        expect(res.headers.get("access-control-allow-origin")).toBe("https://frontend.example.com");
    });

    it("allows only origins listed in ALLOWED_ORIGINS", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: { prepare: vi.fn(() => ({ run: vi.fn(), bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn(() => null) })) })) },
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: "https://frontend.example.com,http://localhost:3000"
        });

        const allowedRes = await app.request(
            "http://localhost/api/auth/github",
            {
                headers: {
                    Origin: "http://localhost:3000"
                }
            },
            env as any
        );

        expect(allowedRes.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    });

    it("blocks origins not listed in ALLOWED_ORIGINS", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: { prepare: vi.fn(() => ({ run: vi.fn(), bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn(() => null) })) })) },
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: "https://frontend.example.com,http://localhost:3000"
        });

        const blockedRes = await app.request(
            "http://localhost/api/auth/github",
            {
                headers: {
                    Origin: "https://evil.example.com"
                }
            },
            env as any
        );

        expect(blockedRes.headers.get("access-control-allow-origin")).toBeNull();
    });
    it("handles OPTIONS preflight with FRONTEND_URL fallback", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: { prepare: vi.fn(() => ({ run: vi.fn(), bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn(() => null) })) })) },
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: undefined
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                method: "OPTIONS",
                headers: {
                    Origin: "https://frontend.example.com",
                    "Access-Control-Request-Method": "POST"
                }
            },
            env as any
        );

        expect(res.headers.get("access-control-allow-origin")).toBe("https://frontend.example.com");
        expect(res.headers.get("access-control-allow-methods")).toContain("POST");
        expect(res.headers.get("access-control-allow-headers")).toBeTruthy();
    });

    it("handles OPTIONS preflight for allowed origins in ALLOWED_ORIGINS", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: { prepare: vi.fn(() => ({ run: vi.fn(), bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn(() => null) })) })) },
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: "https://frontend.example.com,http://localhost:3000"
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:3000",
                    "Access-Control-Request-Method": "POST"
                }
            },
            env as any
        );

        expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
        expect(res.headers.get("access-control-allow-methods")).toContain("POST");
        expect(res.headers.get("access-control-allow-headers")).toBeTruthy();
    });

    it("blocks OPTIONS preflight for origins not listed in ALLOWED_ORIGINS", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: { prepare: vi.fn(() => ({ run: vi.fn(), bind: vi.fn(() => ({ run: vi.fn(), first: vi.fn(() => null) })) })) },
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: "https://frontend.example.com,http://localhost:3000"
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                method: "OPTIONS",
                headers: {
                    Origin: "https://evil.example.com",
                    "Access-Control-Request-Method": "POST"
                }
            },
            env as any
        );

        expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
});
