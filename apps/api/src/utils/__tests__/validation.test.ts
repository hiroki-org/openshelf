import { describe, expect, it } from "vitest";
import { validateSlug, validateName, validateDescription } from "../validation";

describe("validation utils", () => {
    describe("validateSlug", () => {
        it("rejects non-strings", () => {
            expect(validateSlug(123)).toBe("slug is required");
        });

        it("validates length", () => {
            expect(validateSlug("ab")).toBe("slug must be 3–40 characters");
            expect(validateSlug("a".repeat(41))).toBe("slug must be 3–40 characters");
        });

        it("validates character set", () => {
            expect(validateSlug("Invalid Slug")).toBe("slug must contain only lowercase letters, numbers, and hyphens");
            expect(validateSlug("slug!")).toBe("slug must contain only lowercase letters, numbers, and hyphens");
        });

        it("rejects consecutive hyphens", () => {
            expect(validateSlug("my--slug")).toBe("slug must not contain consecutive hyphens");
        });

        it("rejects leading/trailing hyphens", () => {
            expect(validateSlug("-invalid")).toBe("slug must not start or end with a hyphen");
            expect(validateSlug("invalid-")).toBe("slug must not start or end with a hyphen");
        });

        it("accepts valid slugs", () => {
            expect(validateSlug("my-valid-slug-123")).toBeNull();
            expect(validateSlug("abc")).toBeNull();
        });
    });

    describe("validateName", () => {
        it("rejects non-strings or empty strings", () => {
            expect(validateName(null)).toBe("name is required");
            expect(validateName("  ")).toBe("name is required");
        });

        it("validates max length", () => {
            expect(validateName("a".repeat(101))).toBe("name must be 100 characters or less");
        });

        it("accepts valid names", () => {
            expect(validateName("Valid Name")).toBeNull();
        });
    });

    describe("validateDescription", () => {
        it("accepts null, undefined, or empty strings", () => {
            expect(validateDescription(null)).toBeNull();
            expect(validateDescription(undefined)).toBeNull();
            expect(validateDescription("")).toBeNull();
        });

        it("rejects non-strings", () => {
            expect(validateDescription(123)).toBe("description must be a string");
        });

        it("validates max length", () => {
            expect(validateDescription("a".repeat(501))).toBe("description must be 500 characters or less");
        });

        it("accepts valid descriptions", () => {
            expect(validateDescription("This is a valid description.")).toBeNull();
        });
    });
});
