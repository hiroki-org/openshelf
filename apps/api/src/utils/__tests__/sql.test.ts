import { describe, it, expect } from "vitest";
import { escapeLikeLiteral } from "../sql";

describe("escapeLikeLiteral", () => {
  it("escapes %", () => {
    expect(escapeLikeLiteral("100% free")).toBe("100\\% free");
  });

  it("escapes _", () => {
    expect(escapeLikeLiteral("user_name")).toBe("user\\_name");
  });

  it("escapes \\", () => {
    expect(escapeLikeLiteral("C:\\temp")).toBe("C:\\\\temp");
  });

  it("escapes multiple special characters", () => {
    expect(escapeLikeLiteral("%_\\")).toBe("\\%\\_\\\\");
  });

  it("handles empty strings", () => {
    expect(escapeLikeLiteral("")).toBe("");
  });

  it("handles strings without special characters", () => {
    expect(escapeLikeLiteral("hello world")).toBe("hello world");
  });
});
