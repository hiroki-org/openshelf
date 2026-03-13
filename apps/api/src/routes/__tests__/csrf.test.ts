import { describe, expect, it } from "vitest";
import { createTestApp, createTestEnv } from "../../test/helpers";

describe("CSRF configuration", () => {
    it("bypasses CSRF if test auth is properly configured and matches", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "my-secret-key"
        });

        await app.request(
            "http://localhost/api/users",
            {
                method: "POST", // Mutative method to trigger CSRF check
                headers: {
                    "x-test-auth-secret": "my-secret-key"
                }
            },
            env as any
        );

        // It should pass CSRF and fail on Auth or return something else, not 403 Forbidden from CSRF
        // The users route might not have POST, so let's just use POST /api/auth/logout which is valid and mutative
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
});
