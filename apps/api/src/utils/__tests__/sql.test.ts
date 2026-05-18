import { describe, it, expect } from "vitest";
import { escapeLikeLiteral } from "../sql";

describe("escapeLikeLiteral", () => {
  it("escapes % character", () => {
    expect(escapeLikeLiteral("hello%world")).toBe("hello\\%world");
  });

  it("escapes _ character", () => {
    expect(escapeLikeLiteral("hello_world")).toBe("hello\\_world");
  });

  it("escapes \\ character", () => {
    expect(escapeLikeLiteral("hello\\world")).toBe("hello\\\\world");
  });

  it("escapes multiple special characters", () => {
    expect(escapeLikeLiteral("%_\\%_\\")).toBe("\\%\\_\\\\\\%\\_\\\\");
  });

  it("returns empty string if input is empty", () => {
    expect(escapeLikeLiteral("")).toBe("");
  });

  it("returns identical string if no special characters exist", () => {
    expect(escapeLikeLiteral("hello world")).toBe("hello world");
  });
});
