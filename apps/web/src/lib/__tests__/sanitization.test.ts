import { describe, expect, it } from "vitest";
import { safePath, sanitizeId } from "../sanitization";

describe("sanitization", () => {
  it("accepts valid identifiers", () => {
    expect(sanitizeId("paper-123")).toBe("paper-123");
    expect(safePath("paper-123")).toBe("paper-123");
  });

  it("rejects invalid identifiers", () => {
    expect(() => sanitizeId("../paper")).toThrow("Invalid identifier");
    expect(() => safePath("bad slug")).toThrow("Invalid identifier");
  });
});
