import { describe, expect, it } from "vitest";
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
        // Passing an object instead of a string to ALLOWED_ORIGINS to trigger a throw in .split()
        const env = createTestEnv({
            ALLOWED_ORIGINS: { invalid: "not a string" } as any
        });

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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

        expect(res.status).toBe(403); // Middleware returns Forbidden after catching
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "CSRF check error:",
            expect.stringContaining("split is not a function")
        );

        consoleErrorSpy.mockRestore();
    });

    it("logs sanitized error (string type) if CSRF check throws a string", async () => {
        const app = await createTestApp();

        // We mock parseOriginList to throw a string.
        // Since named imports are sometimes hard to mock after the fact,
        // we can trigger a non-Error throw by making something it calls throw.
        // But parseOriginList is quite simple.

        // Let's try to mock the whole module for this test.
        // Actually, in Vitest we can just do:
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
});
