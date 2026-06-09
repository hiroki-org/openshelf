import { describe, it, expect } from "vitest";
import { formatCaughtError } from "../errors";

describe("formatCaughtError", () => {
  it("should format a standard Error object correctly", () => {
    const error = new Error("Something went wrong");
    expect(formatCaughtError(error)).toBe("Error: Something went wrong");
  });

  it("should format custom Error objects correctly", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }
    const error = new CustomError("A custom issue occurred");
    expect(formatCaughtError(error)).toBe(
      "CustomError: A custom issue occurred",
    );
  });

  it("should handle string errors", () => {
    expect(formatCaughtError("string error")).toBe("string error");
  });

  it("should handle null", () => {
    expect(formatCaughtError(null)).toBe("null");
  });

  it("should handle undefined", () => {
    expect(formatCaughtError(undefined)).toBe("undefined");
  });

  it("should handle numbers", () => {
    expect(formatCaughtError(404)).toBe("404");
  });

  it("should handle generic objects", () => {
    // Non-Error objects intentionally use String(value), matching current logging behavior.
    expect(formatCaughtError({ code: 500 })).toBe("[object Object]");
  });
});
