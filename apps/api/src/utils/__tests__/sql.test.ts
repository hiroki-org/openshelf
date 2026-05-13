import { describe, it, expect } from "vitest";
import { escapeLikeLiteral } from "../sql";

describe("sql utils", () => {
    describe("escapeLikeLiteral", () => {
        it("escapes percent signs", () => {
            expect(escapeLikeLiteral("100%")).toBe("100\\%");
        });

        it("escapes underscores", () => {
            expect(escapeLikeLiteral("foo_bar")).toBe("foo\\_bar");
        });

        it("escapes backslashes", () => {
            expect(escapeLikeLiteral("foo\\bar")).toBe("foo\\\\bar");
        });

        it("escapes multiple special characters", () => {
            expect(escapeLikeLiteral("%foo_bar\\")).toBe("\\%foo\\_bar\\\\");
        });

        it("returns the same string if no special characters are present", () => {
            expect(escapeLikeLiteral("foo bar")).toBe("foo bar");
        });

        it("handles empty strings", () => {
            expect(escapeLikeLiteral("")).toBe("");
        });
    });
});
