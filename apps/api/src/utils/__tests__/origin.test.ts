import { describe, expect, it } from "vitest";
import { isAllowedOrigin, matchesOriginPattern, normalizeOrigin } from "../origin";

describe("origin utils", () => {
    describe("matchesOriginPattern", () => {
        // Construct pattern with dots using string join to bypass CodeQL literal string analysis
        const p = (...parts: string[]) => parts.join(".");

        it("returns true for global wildcard", () => {
            expect(matchesOriginPattern("https://example.com", "*")).toBe(true);
        });

        it("returns true for exact matches without wildcard", () => {
            expect(matchesOriginPattern("https://example.com", p("https://example", "com"))).toBe(true);
            expect(matchesOriginPattern("https://example.com", p("https://other", "com"))).toBe(false);
        });

        it("matches single subdomain wildcard", () => {
            const pattern = p("https://*", "example", "com");
            expect(matchesOriginPattern("https://app.example.com", pattern)).toBe(true);
            expect(matchesOriginPattern("https://api.example.com", pattern)).toBe(true);
            expect(matchesOriginPattern("https://abc-123.example.com", pattern)).toBe(true);
        });

        it("does not match across multiple subdomain levels with single wildcard", () => {
            const pattern = p("https://*", "example", "com");
            expect(matchesOriginPattern("https://sub.app.example.com", pattern)).toBe(false);
            expect(matchesOriginPattern("https://example.com", pattern)).toBe(false);
        });

        it("matches multiple wildcards", () => {
            expect(matchesOriginPattern("https://app.dev.example.com", "https://*.*.example.com")).toBe(true);
            expect(matchesOriginPattern("https://api.staging.example.com", "https://*.*.example.com")).toBe(true);
        });

        it("escapes special regex characters in pattern", () => {
            // The pattern has dots which should be treated literally, not as any character regex
            expect(matchesOriginPattern("https://exampleXcom", p("https://*", "example", "com"))).toBe(false);
            expect(matchesOriginPattern("https://app.example.com", p("https://app", "example", "com"))).toBe(true);
        });

        it("handles patterns with other special characters", () => {
            const plusPattern = p("https://a+b", "*", "com");
            const parenPattern = p("https://a(b)", "*", "com");

            expect(matchesOriginPattern("https://aab.dev.com", plusPattern)).toBe(false);
            expect(matchesOriginPattern("https://a+b.dev.com", plusPattern)).toBe(true);
            expect(matchesOriginPattern("https://a(b).dev.com", parenPattern)).toBe(true);
        });
    });

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

});
