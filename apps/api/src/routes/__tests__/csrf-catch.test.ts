import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTestEnv } from "../../test/helpers";

describe("CSRF configuration catch blocks", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("logs sanitized Error object when CSRF check throws an Error", async () => {
        const originalConsoleError = console.error;
        const consoleErrorMock = vi.fn();
        console.error = consoleErrorMock;

        vi.doMock("../../utils/origin", async (importOriginal) => {
            const actual = await importOriginal<any>();
            return {
                ...actual,
                isAllowedOrigin: (_origin: any, _frontendOrigin: any, _allowedOrigins: any, _options: any) => {
                    throw new Error("CSRF mocked error");
                }
            };
        });

        const { default: mockApp } = await import("../../index");
        const env = createTestEnv({});

        await mockApp.request(
            "http://localhost/api/auth/logout",
            { method: "POST" },
            env as any
        );

        expect(consoleErrorMock).toHaveBeenCalledWith("CSRF check error: Error: CSRF mocked error");

        console.error = originalConsoleError;
        vi.doUnmock("../../utils/origin");
    });

    it("logs sanitized string when CSRF check throws a non-Error", async () => {
        const originalConsoleError = console.error;
        const consoleErrorMock = vi.fn();
        console.error = consoleErrorMock;

        vi.doMock("../../utils/origin", async (importOriginal) => {
            const actual = await importOriginal<any>();
            return {
                ...actual,
                isAllowedOrigin: (_origin: any, _frontendOrigin: any, _allowedOrigins: any, _options: any) => {
                    throw "CSRF mocked string error";
                }
            };
        });

        const { default: mockApp } = await import("../../index");
        const env = createTestEnv({});

        await mockApp.request(
            "http://localhost/api/auth/logout",
            { method: "POST" },
            env as any
        );

        expect(consoleErrorMock).toHaveBeenCalledWith("CSRF check error: non-Error exception during CSRF check");

        console.error = originalConsoleError;
        vi.doUnmock("../../utils/origin");
    });

    it("app.onError handles unknown errors and returns 500 JSON", async () => {
        const { default: mockApp } = await import("../../index");
        // Force an error using a dummy route or similar if possible.
        // Alternatively, mock a route to throw an error.
        mockApp.get("/__test_error", () => { throw new Error("Test generic error"); });
        const res = await mockApp.request("http://localhost/__test_error");
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json).toEqual({ error: "Internal Server Error" });
    });
});
