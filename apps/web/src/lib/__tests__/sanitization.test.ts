import { describe, expect, it } from "vitest";
import { safePath, sanitizeId } from "../sanitization";

describe("sanitization", () => {
  describe("sanitizeId", () => {
    it("accepts valid identifiers", () => {
      // Single characters
      expect(sanitizeId("a")).toBe("a");
      expect(sanitizeId("1")).toBe("1");

      // Simple words
      expect(sanitizeId("abc")).toBe("abc");
      expect(sanitizeId("123")).toBe("123");

      // Words with single hyphens
      expect(sanitizeId("paper-123")).toBe("paper-123");
      expect(sanitizeId("a-b-c")).toBe("a-b-c");
      expect(sanitizeId("user-name-123")).toBe("user-name-123");
    });

    it("rejects invalid identifiers", () => {
      // Empty string
      expect(() => sanitizeId("")).toThrow("Invalid identifier");

      // Uppercase characters
      expect(() => sanitizeId("Paper-123")).toThrow("Invalid identifier");

      // Underscores
      expect(() => sanitizeId("paper_123")).toThrow("Invalid identifier");

      // Spaces
      expect(() => sanitizeId("bad slug")).toThrow("Invalid identifier");

      // Dots/slashes/path traversal
      expect(() => sanitizeId("paper.123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper/123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("../paper")).toThrow("Invalid identifier");

      // Starting/ending hyphens
      expect(() => sanitizeId("-paper")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper-")).toThrow("Invalid identifier");
      expect(() => sanitizeId("-")).toThrow("Invalid identifier");

      // Consecutive hyphens
      expect(() => sanitizeId("paper--123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("a--b--c")).toThrow("Invalid identifier");
    });
  });

  describe("safePath", () => {
    it("encodes valid identifiers", () => {
      expect(safePath("paper-123")).toBe("paper-123");
    });

    it("rejects invalid identifiers before encoding", () => {
      expect(() => safePath("bad slug")).toThrow("Invalid identifier");
    });
  });
});
