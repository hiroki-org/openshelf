import { describe, expect, it } from "vitest";
import { createTestApp, createTestEnv } from "../../test/helpers";

describe("test-auth routes", () => {
    it("returns 404 if ENABLE_TEST_AUTH is not true", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "false",
            TEST_AUTH_SECRET: "wrong-secret",
            FRONTEND_URL: "http://localhost",
        });

        const res = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "x-test-auth-secret": "wrong-secret",
                    "origin": "http://localhost",
                    "referer": "http://localhost"
                }
            },
            env as any
        );
        expect(res.status).toBe(404);
    });

    it("returns 404 if TEST_AUTH_SECRET is not configured", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            FRONTEND_URL: "http://localhost",
        });

        const res = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "origin": "http://localhost",
                    "referer": "http://localhost"
                }
            },
            env as any
        );
        expect(res.status).toBe(404);
    });

    it("returns 401 if provided secret does not match", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            ENABLE_TEST_AUTH: "true",
            TEST_AUTH_SECRET: "correct-secret",
            FRONTEND_URL: "http://localhost",
        });

        const res = await app.request(
            "http://localhost/api/test-auth/test-token",
            {
                method: "POST",
                headers: {
                    "x-test-auth-secret": "wrong-secret",
                    "origin": "http://localhost",
                    "referer": "http://localhost"
                }
            },
            env as any
        );
        expect(res.status).toBe(401);
    });
});
