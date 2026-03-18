import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, authHeaders } from "../api";

describe("api helpers", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("authHeaders returns Authorization header when token exists", () => {
        localStorage.setItem("auth_token", "abc123");

        expect(authHeaders()).toEqual({ Authorization: "Bearer abc123" });
    });

    it("authHeaders returns empty object when token does not exist", () => {
        expect(authHeaders()).toEqual({});
    });

    it("authHeaders returns empty object when window is undefined", () => {
        const originalWindow = globalThis.window;
        try {
            // @ts-ignore
            delete globalThis.window;
            expect(authHeaders()).toEqual({});
        } finally {
            globalThis.window = originalWindow;
        }
    });

    it("apiFetch calls API_BASE + path with Authorization header", async () => {
        localStorage.setItem("auth_token", "token-x");
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

        await apiFetch("/api/auth/me", { method: "GET" });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/auth/me");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-x");
    });
});
