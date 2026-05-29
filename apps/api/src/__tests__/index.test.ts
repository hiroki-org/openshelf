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

        // Use type assertion to access the internal errorHandler for unit testing
        const handler = (app as any).errorHandler;
        const result = await handler("Simulated non-Error string" as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "Internal Server Error" }, 500);

        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            expect.stringContaining("Error: Simulated non-Error string")
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

        // Use type assertion to access the internal errorHandler for unit testing
        const handler = (app as any).errorHandler;
        const err = new Error("Simulated Error object");
        err.stack = "Error: Simulated Error object\nSimulated stack trace";
        const result = await handler(err as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "Internal Server Error" }, 500);

        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            "Error: Simulated Error object\nSimulated stack trace"
        );

        console.error = originalConsoleError;
    });
});
