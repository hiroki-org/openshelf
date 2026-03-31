import { describe, expect, it } from "vitest";
import { parseStoredTags } from "../tags";

describe("parseStoredTags", () => {
    it("returns empty array for null/invalid input", () => {
        expect(parseStoredTags(null)).toEqual([]);
        expect(parseStoredTags("")).toEqual([]);
        expect(parseStoredTags("{invalid")).toEqual([]);
        expect(parseStoredTags('"not-array"')).toEqual([]);
    });

    it("trims valid strings and drops non-string/empty values", () => {
        const raw = JSON.stringify([
            " AI ",
            "",
            "   ",
            123,
            null,
            "NLP",
            " Vision ",
        ]);

        expect(parseStoredTags(raw)).toEqual(["AI", "NLP", "Vision"]);
    });
});
