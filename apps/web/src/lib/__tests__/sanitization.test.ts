import { describe, expect, it } from "vitest";
import { safePath, sanitizeId } from "../sanitization";

describe("sanitizeId", () => {
  it("accepts valid identifiers", () => {
    expect(sanitizeId("a")).toBe("a");
    expect(sanitizeId("1")).toBe("1");
    expect(sanitizeId("a1")).toBe("a1");
    expect(sanitizeId("1a")).toBe("1a");
    expect(sanitizeId("paper-123")).toBe("paper-123");
    expect(sanitizeId("a-b-c-d")).toBe("a-b-c-d");
    expect(sanitizeId("long-valid-slug-1234567890")).toBe(
      "long-valid-slug-1234567890",
    );
  });

  it("rejects empty identifiers", () => {
    expect(() => sanitizeId("")).toThrow("Invalid identifier");
  });

  it("rejects identifiers starting or ending with hyphens", () => {
    expect(() => sanitizeId("-a")).toThrow("Invalid identifier");
    expect(() => sanitizeId("a-")).toThrow("Invalid identifier");
    expect(() => sanitizeId("-paper-123-")).toThrow("Invalid identifier");
  });

  it("rejects consecutive hyphens", () => {
    expect(() => sanitizeId("a--b")).toThrow("Invalid identifier");
    expect(() => sanitizeId("paper--123")).toThrow("Invalid identifier");
  });

  it("rejects invalid characters and path traversal", () => {
    expect(() => sanitizeId("../paper")).toThrow("Invalid identifier");
    expect(() => sanitizeId("paper/123")).toThrow("Invalid identifier");
    expect(() => sanitizeId("/paper")).toThrow("Invalid identifier");
    expect(() => sanitizeId("bad slug")).toThrow("Invalid identifier");
    expect(() => sanitizeId("bad_slug")).toThrow("Invalid identifier");
    expect(() => sanitizeId("bad@slug")).toThrow("Invalid identifier");
    expect(() => sanitizeId("UPPERCASE")).toThrow("Invalid identifier");
  });
});

describe("safePath", () => {
  it("encodes and accepts valid identifiers", () => {
    expect(safePath("paper-123")).toBe("paper-123");
    expect(safePath("a-b-c")).toBe("a-b-c");
  });

  it("rejects invalid identifiers before encoding", () => {
    expect(() => safePath("../paper")).toThrow("Invalid identifier");
    expect(() => safePath("bad slug")).toThrow("Invalid identifier");
    expect(() => safePath("a--b")).toThrow("Invalid identifier");
    expect(() => safePath("")).toThrow("Invalid identifier");
  });
});
