import { describe, it, expect } from "vitest";
import { validateSlug, validateName } from "../validation";

describe("validateSlug", () => {
  it("requires a string", () => {
    expect(validateSlug(undefined)).toBe("slug is required");
    expect(validateSlug(null)).toBe("slug is required");
    expect(validateSlug(123)).toBe("slug is required");
  });

  it("checks length", () => {
    expect(validateSlug("ab")).toBe("slug must be 3-40 characters");
    expect(validateSlug("a".repeat(41))).toBe("slug must be 3-40 characters");
  });

  it("validates characters", () => {
    expect(validateSlug("invalid_slug")).toBe("slug must contain only lowercase letters, numbers, and hyphens");
    expect(validateSlug("invalid slug")).toBe("slug must contain only lowercase letters, numbers, and hyphens");
    expect(validateSlug("-invalid")).toBe("slug must contain only lowercase letters, numbers, and hyphens");
    expect(validateSlug("invalid-")).toBe("slug must contain only lowercase letters, numbers, and hyphens");
  });

  it("prevents consecutive hyphens", () => {
    expect(validateSlug("invalid--slug")).toBe("slug must not contain consecutive hyphens");
  });

  it("accepts valid slugs", () => {
    expect(validateSlug("valid-slug")).toBeNull();
    expect(validateSlug("valid-slug-123")).toBeNull();
    expect(validateSlug("123-valid")).toBeNull();
    expect(validateSlug("abc")).toBeNull();
  });
});

describe("validateName", () => {
  it("requires a non-empty string", () => {
    expect(validateName(undefined)).toBe("name is required");
    expect(validateName(null)).toBe("name is required");
    expect(validateName("")).toBe("name is required");
    expect(validateName("   ")).toBe("name is required");
  });

  it("checks maximum length", () => {
    expect(validateName("a".repeat(101))).toBe("name must be 100 characters or less");
  });

  it("accepts valid names", () => {
    expect(validateName("Valid Name")).toBeNull();
    expect(validateName("a")).toBeNull();
    expect(validateName("a".repeat(100))).toBeNull();
  });
});
