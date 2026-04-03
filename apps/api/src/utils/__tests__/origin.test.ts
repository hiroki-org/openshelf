import { describe, expect, it } from "vitest";
import { isAllowedOrigin, normalizeOrigin } from "../origin";

describe("origin utils", () => {
    it("normalizes exact origins before comparison", () => {
        const origin = normalizeOrigin("https://app.example.com")!;
        const frontendOrigin = normalizeOrigin("https://frontend.example.com")!;
        const allowedOrigins = ["https://app.example.com/", "https://other.example.com"];

        expect(isAllowedOrigin(origin, frontendOrigin, allowedOrigins)).toBe(true);
    });

    it("rejects wildcard allowlist for CSRF checks", () => {
        const origin = normalizeOrigin("https://evil.example.com")!;
        const frontendOrigin = normalizeOrigin("https://frontend.example.com")!;

        expect(isAllowedOrigin(origin, frontendOrigin, ["*"], { allowWildcard: false })).toBe(false);
        expect(isAllowedOrigin(origin, frontendOrigin, ["*"], { allowWildcard: true })).toBe(true);
    });
});
