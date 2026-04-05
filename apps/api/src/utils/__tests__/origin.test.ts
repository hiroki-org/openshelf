import { describe, expect, it } from "vitest";
import { isAllowedOrigin, matchesOriginPattern, normalizeOrigin, parseOriginList, resolveAllowedOrigin } from "../origin";

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

    it("matches multi-level subdomains and ports for wildcard hosts", () => {
        const frontendOrigin = normalizeOrigin("https://frontend.example.com");
        expect(
            isAllowedOrigin(
                "https://sub.sub.example.com:8443",
                frontendOrigin,
                ["https://*.example.com:8443"],
                { allowWildcard: true },
            ),
        ).toBe(true);
    });

    it("returns false for null or undefined origin", () => {
        const frontendOrigin = normalizeOrigin("https://frontend.example.com");
        expect(isAllowedOrigin(null, frontendOrigin, ["https://frontend.example.com"])).toBe(false);
        expect(isAllowedOrigin(undefined, frontendOrigin, ["https://frontend.example.com"])).toBe(false);
    });

    it("allows origin that matches frontendOrigin even if not in allowedOrigins list", () => {
        const origin = "https://frontend.example.com";
        expect(isAllowedOrigin(origin, origin, [])).toBe(true);
    });

    it("rejects unlisted origin when allowedOrigins is empty and it does not match frontendOrigin", () => {
        expect(
            isAllowedOrigin("https://attacker.example.com", "https://frontend.example.com", []),
        ).toBe(false);
    });

});

describe("normalizeOrigin", () => {
    it("returns origin portion of a valid URL", () => {
        expect(normalizeOrigin("https://example.com/path?q=1")).toBe("https://example.com");
    });

    it("returns null for undefined input", () => {
        expect(normalizeOrigin(undefined)).toBeNull();
    });

    it("returns null for an empty string", () => {
        expect(normalizeOrigin("")).toBeNull();
    });

    it("falls back to decoding percent-encoded URLs", () => {
        const encoded = "https%3A%2F%2Fexample.com";
        expect(normalizeOrigin(encoded)).toBe("https://example.com");
    });

    it("returns null for completely invalid strings", () => {
        expect(normalizeOrigin("not-a-url-at-all")).toBeNull();
    });
});

describe("parseOriginList", () => {
    it("splits a comma-separated string into an array", () => {
        expect(parseOriginList("https://a.com,https://b.com")).toEqual([
            "https://a.com",
            "https://b.com",
        ]);
    });

    it("trims whitespace around entries", () => {
        expect(parseOriginList("  https://a.com ,  https://b.com  ")).toEqual([
            "https://a.com",
            "https://b.com",
        ]);
    });

    it("filters out empty entries", () => {
        expect(parseOriginList("https://a.com,,https://b.com")).toEqual([
            "https://a.com",
            "https://b.com",
        ]);
    });

    it("returns an empty array for undefined input", () => {
        expect(parseOriginList(undefined)).toEqual([]);
    });

    it("returns an empty array for an empty string", () => {
        expect(parseOriginList("")).toEqual([]);
    });
});

describe("matchesOriginPattern", () => {
    it("returns true for exact match", () => {
        expect(matchesOriginPattern("https://example.com", "https://example.com")).toBe(true);
    });

    it("returns false for non-matching exact pattern", () => {
        expect(matchesOriginPattern("https://other.com", "https://example.com")).toBe(false);
    });

    it("returns true for wildcard '*' pattern", () => {
        expect(matchesOriginPattern("https://anything.example.com", "*")).toBe(true);
    });

    it("matches wildcard subdomain pattern", () => {
        expect(matchesOriginPattern("https://app.example.com", "https://*.example.com")).toBe(true);
    });

    it("does not match bare apex domain for wildcard subdomain pattern", () => {
        expect(matchesOriginPattern("https://example.com", "https://*.example.com")).toBe(false);
    });
});

describe("resolveAllowedOrigin", () => {
    it("returns the first allowed candidate origin", () => {
        const result = resolveAllowedOrigin(
            ["https://staging.example.com", "https://other.example.com"],
            "https://frontend.example.com",
            ["https://staging.example.com"],
        );
        expect(result).toBe("https://staging.example.com");
    });

    it("falls back to frontendUrl origin when no candidate is allowed", () => {
        const result = resolveAllowedOrigin(
            ["https://attacker.com"],
            "https://frontend.example.com",
            [],
        );
        expect(result).toBe("https://frontend.example.com");
    });

    it("skips undefined candidates", () => {
        const result = resolveAllowedOrigin(
            [undefined, "https://staging.example.com"],
            "https://frontend.example.com",
            ["https://staging.example.com"],
        );
        expect(result).toBe("https://staging.example.com");
    });

    it("accepts the frontendUrl itself as an allowed candidate", () => {
        const result = resolveAllowedOrigin(
            ["https://frontend.example.com"],
            "https://frontend.example.com",
            [],
        );
        expect(result).toBe("https://frontend.example.com");
    });
});