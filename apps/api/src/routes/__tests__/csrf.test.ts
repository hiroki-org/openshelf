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

    it("logs sanitized error if CSRF try block throws", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "false",
        });

        let callCount = 0;
        Object.defineProperty(env, 'ALLOWED_ORIGINS', {
            get() {
                if (callCount === 0) {
                    callCount++;
                    return ""; // First call in CORS
                }
                throw new Error("Mocked environment error"); // Second call in CSRF
            }
        });

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            await app.request(
                "http://localhost/api/auth/logout",
                {
                    method: "POST"
                },
                env as any
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith("CSRF check error: Error: Mocked environment error");
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});
