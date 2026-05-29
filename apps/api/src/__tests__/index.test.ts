import { describe, expect, it, vi } from "vitest";
import { createTestEnv } from "../test/helpers";

describe("Global app.onError handler logic", () => {

    it("returns 500 JSON response and logs safely when a non-Error is thrown", async () => {
        const consoleErrorMock = vi.fn();
        const originalConsoleError = console.error;
        console.error = consoleErrorMock;

        const { default: app } = await import("../index");

        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 500 })
        } as any;

        const handler = app.errorHandler;
        const result = await handler("Simulated non-Error string" as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "Internal Server Error" }, 500);

        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            "Error: Simulated non-Error string",
            expect.any(String) // The stack trace is technically generated dynamically when new Error() is called inside the handler
        );

        console.error = originalConsoleError;
    });

    it("returns 500 JSON response and logs safely when an Error is thrown", async () => {
        const consoleErrorMock = vi.fn();
        const originalConsoleError = console.error;
        console.error = consoleErrorMock;

        const { default: app } = await import("../index");

        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 500 })
        } as any;

        const handler = app.errorHandler;
        const err = new Error("Simulated Error object");
        err.stack = "Simulated stack trace";
        const result = await handler(err as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "Internal Server Error" }, 500);

        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            "Error: Simulated Error object",
            "\nSimulated stack trace"
        );

        console.error = originalConsoleError;
    });
});
