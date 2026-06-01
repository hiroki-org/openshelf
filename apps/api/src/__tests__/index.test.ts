import { describe, expect, it, vi, afterEach } from "vitest";
import { HTTPException } from "hono/http-exception";

describe("Global app.onError handler logic", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns 500 JSON response and logs safely when a non-Error is thrown", async () => {
        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

        const { default: app } = await import("../index");

        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 500 })
        } as any;

        const handler = (app as any).errorHandler;
        const result = await handler("Simulated non-Error string" as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "Internal Server Error" }, 500);

        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            "Error: Simulated non-Error string",
            expect.stringContaining("Error: Simulated non-Error string")
        );
    });

    it("returns 500 JSON response and logs safely when an Error is thrown", async () => {
        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

        const { default: app } = await import("../index");

        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 500 })
        } as any;

        const handler = (app as any).errorHandler;
        const err = new Error("Simulated Error object");
        err.stack = "Error: Simulated Error object\nSimulated stack trace";
        const result = await handler(err as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "Internal Server Error" }, 500);

        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            "Error: Simulated Error object",
            "\nError: Simulated Error object\nSimulated stack trace"
        );
    });

    it("preserves JSON HTTPException responses", async () => {
        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
        const { default: app } = await import("../index");
        const handler = (app as any).errorHandler;
        const response = new Response(JSON.stringify({ error: "Custom" }), {
            status: 418,
            headers: { "content-type": "application/json" },
        });

        const result = await handler(new HTTPException(418, { res: response }), {
            json: vi.fn(),
        } as any);

        expect(result.status).toBe(418);
        await expect(result.json()).resolves.toEqual({ error: "Custom" });
        expect(consoleErrorMock).not.toHaveBeenCalled();
    });

    it("converts non-JSON HTTPException responses to JSON", async () => {
        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
        const { default: app } = await import("../index");
        const handler = (app as any).errorHandler;
        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 401 }),
        } as any;

        const result = await handler(new HTTPException(401), testContext);

        expect(result).toEqual({ json: true, status: 401 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "HTTP Error" }, 401);
        expect(consoleErrorMock).not.toHaveBeenCalled();
    });

    it("handles HTTPException responses without content type", async () => {
        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
        const { default: app } = await import("../index");
        const handler = (app as any).errorHandler;
        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 400 }),
        } as any;
        const response = new Response("Bad Request", { status: 400 });

        const result = await handler(new HTTPException(400, { res: response }), testContext);

        expect(result).toEqual({ json: true, status: 400 });
        expect(testContext.json).toHaveBeenCalledWith({ error: "HTTP Error" }, 400);
        expect(consoleErrorMock).not.toHaveBeenCalled();
    });

    it("logs safely when an Error has no stack", async () => {
        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
        const { default: app } = await import("../index");
        const testContext = {
            json: vi.fn().mockReturnValue({ json: true, status: 500 }),
        } as any;
        const handler = (app as any).errorHandler;
        const err = new Error("No stack");
        err.stack = undefined;

        const result = await handler(err as any, testContext);

        expect(result).toEqual({ json: true, status: 500 });
        expect(consoleErrorMock).toHaveBeenCalledWith(
            "Unhandled exception:",
            "Error: No stack",
            "",
        );
    });
});
