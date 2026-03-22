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

    it("blocks CSRF if x-test-auth-secret is missing when test auth is enabled", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "my-secret-key"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {}
            },
            env as any
        );
        expect(res.status).toBe(403);
    });

    it("allows CSRF if Origin matches FRONTEND_URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: "https://frontend.example.com"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    Origin: "https://frontend.example.com"
                }
            },
            env as any
        );
        expect(res.status).toBe(200);
    });

    it("allows CSRF if Referer matches FRONTEND_URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: "https://frontend.example.com"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    Referer: "https://frontend.example.com/some-page"
                }
            },
            env as any
        );
        expect(res.status).toBe(200);
    });

    it("allows CSRF if Origin is in ALLOWED_ORIGINS", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: "https://frontend.example.com",
            ALLOWED_ORIGINS: "https://another.example.com"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    Origin: "https://another.example.com"
                }
            },
            env as any
        );
        expect(res.status).toBe(200);
    });

    it("blocks CSRF if Origin and Referer are missing", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: "https://frontend.example.com"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {}
            },
            env as any
        );
        expect(res.status).toBe(403);
    });

    it("handles invalid Referer URL gracefully", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: "https://frontend.example.com"
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    Referer: "not-a-url"
                }
            },
            env as any
        );
        expect(res.status).toBe(403);
    });

    it("triggers the catch block and returns 403 on URL parsing error", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: "invalid-url-format"
        });

        // Spy on console.error to verify the catch block is executed
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const res = await app.request(
                "http://localhost/api/auth/logout",
                {
                    method: "POST",
                    headers: {
                        Origin: "https://another.example.com"
                    }
                },
                env as any
            );

            expect(res.status).toBe(403);
            expect(await res.text()).toBe("Forbidden");
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("CSRF check error"));
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});
