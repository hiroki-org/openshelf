import { describe, it, expect } from "vitest";
import { escapeLikeLiteral } from "../sql";

describe("escapeLikeLiteral", () => {
    it("escapes % character", () => {
        expect(escapeLikeLiteral("100%")).toBe("100\\%");
        expect(escapeLikeLiteral("%100")).toBe("\\%100");
    });

    it("escapes _ character", () => {
        expect(escapeLikeLiteral("my_string")).toBe("my\\_string");
    });

    it("escapes \\ character", () => {
        expect(escapeLikeLiteral("C:\\path")).toBe("C:\\\\path");
    });

    it("does nothing to plain strings", () => {
        expect(escapeLikeLiteral("hello world")).toBe("hello world");
    });
});
