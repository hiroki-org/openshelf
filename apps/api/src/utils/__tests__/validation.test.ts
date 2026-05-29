import { describe, it, expect } from "vitest";
import {
  validateSlug,
  validateName,
  ERROR_SLUG_REQUIRED,
  ERROR_SLUG_LENGTH,
  ERROR_SLUG_CHARACTERS,
  ERROR_SLUG_HYPHENS,
  ERROR_NAME_REQUIRED,
  ERROR_NAME_LENGTH,
} from "../validation";

describe("validateSlug", () => {
  it("requires a string", () => {
    expect(validateSlug(undefined)).toBe(ERROR_SLUG_REQUIRED);
    expect(validateSlug(null)).toBe(ERROR_SLUG_REQUIRED);
    expect(validateSlug(123)).toBe(ERROR_SLUG_REQUIRED);
  });

  it("checks length", () => {
    expect(validateSlug("ab")).toBe(ERROR_SLUG_LENGTH);
    expect(validateSlug("a".repeat(41))).toBe(ERROR_SLUG_LENGTH);
  });

  it("validates characters", () => {
    expect(validateSlug("invalid_slug")).toBe(ERROR_SLUG_CHARACTERS);
    expect(validateSlug("invalid slug")).toBe(ERROR_SLUG_CHARACTERS);
    expect(validateSlug("-invalid")).toBe(ERROR_SLUG_CHARACTERS);
    expect(validateSlug("invalid-")).toBe(ERROR_SLUG_CHARACTERS);
  });

  it("prevents consecutive hyphens", () => {
    expect(validateSlug("invalid--slug")).toBe(ERROR_SLUG_HYPHENS);
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
    expect(validateName(undefined)).toBe(ERROR_NAME_REQUIRED);
    expect(validateName(null)).toBe(ERROR_NAME_REQUIRED);
    expect(validateName("")).toBe(ERROR_NAME_REQUIRED);
    expect(validateName("   ")).toBe(ERROR_NAME_REQUIRED);
  });

  it("checks maximum length", () => {
    expect(validateName("a".repeat(101))).toBe(ERROR_NAME_LENGTH);
  });

  it("accepts valid names", () => {
    expect(validateName("Valid Name")).toBeNull();
    expect(validateName("a")).toBeNull();
    expect(validateName("a".repeat(100))).toBeNull();
  });
});
