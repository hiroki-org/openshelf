import { describe, expect, it } from "vitest";
import { safePath, sanitizeId } from "../sanitization";

describe("sanitization", () => {
  describe("sanitizeId", () => {
    it("accepts valid identifiers", () => {
      expect(sanitizeId("a")).toBe("a");
      expect(sanitizeId("1")).toBe("1");
      expect(sanitizeId("abc")).toBe("abc");
      expect(sanitizeId("123")).toBe("123");
      expect(sanitizeId("paper-123")).toBe("paper-123");
      expect(sanitizeId("paper--123")).toBe("paper--123");
      expect(sanitizeId("a-b-c")).toBe("a-b-c");
      expect(sanitizeId("a--b--c")).toBe("a--b--c");
      expect(sanitizeId("user-name-123")).toBe("user-name-123");
    });

    it("rejects invalid identifiers", () => {
      expect(() => sanitizeId("")).toThrow("Invalid identifier");
      expect(() => sanitizeId("Paper-123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper_123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper@123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper#test")).toThrow("Invalid identifier");
      expect(() => sanitizeId("bad slug")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper.123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper/123")).toThrow("Invalid identifier");
      expect(() => sanitizeId("../paper")).toThrow("Invalid identifier");
      expect(() => sanitizeId("-paper")).toThrow("Invalid identifier");
      expect(() => sanitizeId("paper-")).toThrow("Invalid identifier");
      expect(() => sanitizeId("-")).toThrow("Invalid identifier");
    });

    it("accepts very long numeric-only identifiers", () => {
      const longId = "123".repeat(80);
      expect(sanitizeId(longId)).toBe(longId);
    });
  });

  describe("safePath", () => {
    it("encodes valid identifiers", () => {
      expect(safePath("paper-123")).toBe("paper-123");
    });

    it("rejects invalid identifiers before encoding", () => {
      expect(() => safePath("bad slug")).toThrow("Invalid identifier");
      expect(() => safePath("../../etc/passwd")).toThrow("Invalid identifier");
    });
  });
});
