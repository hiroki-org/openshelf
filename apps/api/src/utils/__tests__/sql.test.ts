import { describe, it, expect } from "vitest";
import { escapeLikeLiteral } from "../sql";

describe("escapeLikeLiteral", () => {
  it("escapes percent signs", () => {
    expect(escapeLikeLiteral("100% true")).toBe("100\\% true");
  });

  it("escapes underscores", () => {
    expect(escapeLikeLiteral("my_string")).toBe("my\\_string");
  });

  it("escapes backslashes", () => {
    expect(escapeLikeLiteral("C:\\path")).toBe("C:\\\\path");
  });

  it("escapes a combination", () => {
    expect(escapeLikeLiteral("100%_\\")).toBe("100\\%\\_\\\\");
  });

  it("returns unchanged if no special chars", () => {
    expect(escapeLikeLiteral("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeLikeLiteral("")).toBe("");
  });
});
