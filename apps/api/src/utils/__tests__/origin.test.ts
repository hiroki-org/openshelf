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

    it("rejects wildcard subdomain patterns for CSRF checks", () => {
        const origin = normalizeOrigin("https://app.example.com")!;
        const frontendOrigin = normalizeOrigin("https://frontend.example.com")!;

        expect(isAllowedOrigin(origin, frontendOrigin, ["https://*.example.com"], { allowWildcard: false })).toBe(false);
        expect(isAllowedOrigin(origin, frontendOrigin, ["https://*.example.com"], { allowWildcard: true })).toBe(true);
    });

    it("does not let wildcard cross host boundary", () => {
        expect(
            isAllowedOrigin(
                "https://evil.com/?.example.com",
                normalizeOrigin("https://frontend.example.com"),
                ["https://*.example.com"],
                { allowWildcard: true },
            ),
        ).toBe(false);
    });

    it("allows request when origin matches frontend origin directly", () => {
        expect(
            isAllowedOrigin(
                "https://frontend.example.com",
                "https://frontend.example.com",
                ["https://other.example.com"],
                { allowWildcard: false },
            ),
        ).toBe(true);
    });

    it("supports wildcard subdomain patterns with nested labels and ports", () => {
        expect(
            isAllowedOrigin(
                "https://sub.app.example.com:8443",
                normalizeOrigin("https://frontend.example.com"),
                ["https://*.example.com:8443"],
                { allowWildcard: true },
            ),
        ).toBe(true);
    });


});
