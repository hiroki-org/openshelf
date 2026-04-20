import { describe, expect, it, vi } from "vitest";
import { createTestApp, createTestEnv } from "../../test/helpers";

describe("CSRF configuration", () => {
    it("bypasses CSRF if test auth is properly configured and matches", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "my-secret-key"
        });

        const logoutRes = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    "x-test-auth-secret": "my-secret-key"
                }
            },
            env as any
        );
        expect(logoutRes.status).toBe(200);
    });

    it("blocks CSRF if test auth secret is wrong", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "my-secret-key"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    "x-test-auth-secret": "wrong-secret"
                }
            },
            env as any
        );
        expect(res.status).toBe(403);
    });

    it("blocks CSRF if ENABLE_TEST_AUTH is false", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "false",
            TEST_AUTH_SECRET: "my-secret-key"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    "x-test-auth-secret": "my-secret-key"
                }
            },
            env as any
        );
        expect(res.status).toBe(403);
    });

    it("blocks CSRF if x-test-auth-secret is present but not configured", async () => {
        const app = await createTestApp();
        const env = createTestEnv({});

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    "x-test-auth-secret": "any-value"
                }
            },
            env as any
        );
        expect(res.status).toBe(403);
    });

    it("logs sanitized error if CSRF check throws", async () => {
        const app = await createTestApp();

        const originUtils = await import("../../utils/origin");
        const spy = vi.spyOn(originUtils, "parseOriginList").mockImplementation(() => {
            throw new Error("CSRF logic failed");
        });

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    "Origin": "http://localhost:3000"
                }
            },
            env as any
        );

        expect(res.status).toBe(403);
        expect(consoleErrorSpy).toHaveBeenCalledWith("CSRF check error:", "CSRF logic failed");

        consoleErrorSpy.mockRestore();
        spy.mockRestore();
    });

    it("logs sanitized error (string type) if CSRF check throws a string", async () => {
        const app = await createTestApp();

        const originUtils = await import("../../utils/origin");
        const spy = vi.spyOn(originUtils, "parseOriginList").mockImplementation(() => {
            throw "String error";
        });

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const env = createTestEnv();
        await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    "Origin": "http://localhost:3000"
                }
            },
            env as any
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith("CSRF check error:", "String error");

        consoleErrorSpy.mockRestore();
        spy.mockRestore();
    });

    it("logs sanitized error if CORS check throws", async () => {
        const app = await createTestApp();

        const originUtils = await import("../../utils/origin");
        const spy = vi.spyOn(originUtils, "parseOriginList").mockImplementation(() => {
            throw new Error("CORS logic failed");
        });

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "OPTIONS",
                headers: {
                    "Access-Control-Request-Method": "POST",
                    "Origin": "http://localhost:3000"
                }
            },
            env as any
        );

        // CORS failure usually means it doesn't add CORS headers,
        // Hono's cors middleware might return a response or just proceed.
        // But our goal is to check the console error.
        expect(consoleErrorSpy).toHaveBeenCalledWith("CORS origin check error:", "CORS logic failed");

        consoleErrorSpy.mockRestore();
        spy.mockRestore();
    });
});
