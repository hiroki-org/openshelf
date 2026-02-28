import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, createTestEnv, makeQuery } from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb)
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
});
