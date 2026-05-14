import { describe, it, expect } from "vitest";
import { escapeLikeLiteral } from "../sql";

describe("escapeLikeLiteral", () => {
  it("escapes percent signs", () => {
    expect(escapeLikeLiteral("100%")).toBe("100\\%");
  });

  it("escapes underscores", () => {
    expect(escapeLikeLiteral("my_string")).toBe("my\\_string");
  });

  it("escapes backslashes", () => {
    expect(escapeLikeLiteral("C:\\path")).toBe("C:\\\\path");
  });

  it("escapes multiple special characters", () => {
    expect(escapeLikeLiteral("100%_my\\string")).toBe("100\\%\\_my\\\\string");
  });

  it("returns the same string if no special characters are present", () => {
    expect(escapeLikeLiteral("hello world")).toBe("hello world");
  });
});
