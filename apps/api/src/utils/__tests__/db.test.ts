import { describe, it, expect } from "vitest";
import { isUniqueConstraintError } from "../db";

describe("isUniqueConstraintError", () => {
  it("returns true for Error instance with UNIQUE constraint message", () => {
    const err = new Error(
      "SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email",
    );
    expect(isUniqueConstraintError(err)).toBe(true);
  });

  it("returns false for Error instance with other message", () => {
    const err = new Error("NOT NULL constraint failed: users.name");
    expect(isUniqueConstraintError(err)).toBe(false);
  });

  it("returns true for string with UNIQUE constraint message", () => {
    expect(
      isUniqueConstraintError("UNIQUE constraint failed: users.email"),
    ).toBe(true);
  });

  it("returns false for string with other message", () => {
    expect(isUniqueConstraintError("Some other database error")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isUniqueConstraintError(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isUniqueConstraintError(null)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isUniqueConstraintError(404)).toBe(false);
  });

  it("returns false for a generic object", () => {
    expect(
      isUniqueConstraintError({ message: "UNIQUE constraint failed" }),
    ).toBe(false);
  });
});
