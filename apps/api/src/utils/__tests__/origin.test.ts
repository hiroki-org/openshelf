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

});

describe("normalizeOrigin", () => {
    it("returns null for undefined input", () => {
        expect(normalizeOrigin(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(normalizeOrigin("")).toBeNull();
    });

    it("strips path and query from a full URL", () => {
        expect(normalizeOrigin("https://example.com/some/path?q=1")).toBe("https://example.com");
    });

    it("strips trailing slash from origin", () => {
        expect(normalizeOrigin("https://example.com/")).toBe("https://example.com");
    });

    it("preserves non-default port in origin", () => {
        expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    });

    it("returns null for a completely invalid URL", () => {
        expect(normalizeOrigin("not-a-url")).toBeNull();
    });

    it("decodes a percent-encoded URL and extracts origin", () => {
        expect(normalizeOrigin("https%3A%2F%2Fexample.com")).toBe("https://example.com");
    });
});

describe("parseOriginList", () => {
    it("returns empty array for undefined input", () => {
        expect(parseOriginList(undefined)).toEqual([]);
    });

    it("returns empty array for empty string", () => {
        expect(parseOriginList("")).toEqual([]);
    });

    it("parses a single origin", () => {
        expect(parseOriginList("https://example.com")).toEqual(["https://example.com"]);
    });

    it("splits on commas and trims whitespace", () => {
        expect(parseOriginList("https://a.com, https://b.com ,https://c.com")).toEqual([
            "https://a.com",
            "https://b.com",
            "https://c.com",
        ]);
    });

    it("filters out empty entries from consecutive commas", () => {
        expect(parseOriginList("https://a.com,,https://b.com")).toEqual([
            "https://a.com",
            "https://b.com",
        ]);
    });
});

describe("matchesOriginPattern", () => {
    it("matches the bare wildcard * against any origin", () => {
        expect(matchesOriginPattern("https://anything.com", "*")).toBe(true);
    });

    it("returns true for exact match with no wildcard", () => {
        expect(matchesOriginPattern("https://example.com", "https://example.com")).toBe(true);
    });

    it("returns false for non-matching exact pattern", () => {
        expect(matchesOriginPattern("https://other.com", "https://example.com")).toBe(false);
    });

    it("matches wildcard subdomain pattern", () => {
        expect(matchesOriginPattern("https://app.example.com", "https://*.example.com")).toBe(true);
    });

    it("does not match when the host segment contains a dot (subdomain of subdomain)", () => {
        // The regex [a-zA-Z0-9-]+ does not allow dots so deep sub-subdomains are rejected
        expect(matchesOriginPattern("https://deep.sub.example.com", "https://*.example.com")).toBe(false);
    });
});

describe("resolveAllowedOrigin", () => {
    it("returns the first allowed candidate", () => {
        const result = resolveAllowedOrigin(
            ["https://staging.example.com", "https://prod.example.com"],
            "https://frontend.example.com",
            ["https://staging.example.com", "https://prod.example.com"],
        );
        expect(result).toBe("https://staging.example.com");
    });

    it("skips disallowed candidates and returns first allowed one", () => {
        const result = resolveAllowedOrigin(
            ["https://evil.com", "https://allowed.example.com"],
            "https://frontend.example.com",
            ["https://allowed.example.com"],
        );
        expect(result).toBe("https://allowed.example.com");
    });

    it("falls back to normalized frontendUrl when no candidate is allowed", () => {
        const result = resolveAllowedOrigin(
            ["https://evil.com"],
            "https://frontend.example.com",
            ["https://other.example.com"],
        );
        expect(result).toBe("https://frontend.example.com");
    });

    it("falls back to frontendUrl when candidates list is empty", () => {
        const result = resolveAllowedOrigin(
            [],
            "https://frontend.example.com",
            ["https://other.example.com"],
        );
        expect(result).toBe("https://frontend.example.com");
    });

    it("allows the frontendUrl origin itself as a valid candidate", () => {
        const result = resolveAllowedOrigin(
            ["https://frontend.example.com"],
            "https://frontend.example.com",
            [],
        );
        expect(result).toBe("https://frontend.example.com");
    });

    it("skips undefined candidates without throwing", () => {
        const result = resolveAllowedOrigin(
            [undefined, "https://allowed.example.com"],
            "https://frontend.example.com",
            ["https://allowed.example.com"],
        );
        expect(result).toBe("https://allowed.example.com");
    });
});

describe("isAllowedOrigin", () => {
    it("returns false for null origin", () => {
        expect(isAllowedOrigin(null, "https://frontend.example.com", ["https://allowed.com"])).toBe(false);
    });

    it("returns false for undefined origin", () => {
        expect(isAllowedOrigin(undefined, "https://frontend.example.com", ["https://allowed.com"])).toBe(false);
    });

    it("returns true when origin equals frontendOrigin even with empty allowlist", () => {
        expect(isAllowedOrigin("https://frontend.example.com", "https://frontend.example.com", [])).toBe(true);
    });

    it("returns false when origin is not in allowlist and does not match frontendOrigin", () => {
        expect(isAllowedOrigin("https://other.com", "https://frontend.example.com", [])).toBe(false);
    });
});