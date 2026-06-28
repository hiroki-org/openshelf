import { describe, expect, it } from "vitest";
import { safePath, sanitizeId } from "../sanitization";

describe("sanitization", () => {
  it("accepts valid identifiers", () => {
    expect(sanitizeId("paper-123")).toBe("paper-123");
    expect(safePath("paper-123")).toBe("paper-123");

    // Edge cases for valid identifiers
    expect(sanitizeId("a")).toBe("a");
    expect(sanitizeId("1")).toBe("1");
    expect(sanitizeId("a-b")).toBe("a-b");
    expect(sanitizeId("abc-123-def")).toBe("abc-123-def");
  });

  it("rejects invalid identifiers", () => {
    expect(() => sanitizeId("../paper")).toThrow("Invalid identifier");
    expect(() => safePath("bad slug")).toThrow("Invalid identifier");

    // Edge cases for invalid identifiers
    expect(() => sanitizeId("")).toThrow("Invalid identifier");
    expect(() => sanitizeId("-abc")).toThrow("Invalid identifier");
    expect(() => sanitizeId("abc-")).toThrow("Invalid identifier");
    expect(() => sanitizeId("ab--cd")).toThrow("Invalid identifier");
    expect(() => sanitizeId("Abc-123")).toThrow("Invalid identifier");
    expect(() => sanitizeId("abc_123")).toThrow("Invalid identifier");
    expect(() => sanitizeId(undefined as any)).toThrow("Invalid identifier");
    expect(() => sanitizeId(null as any)).toThrow("Invalid identifier");
  });
});
