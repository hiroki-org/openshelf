import { describe, it, expect } from "vitest";
import { parseStoredTags } from "../tags";

describe("parseStoredTags", () => {
    it("returns an empty array for null input", () => {
        expect(parseStoredTags(null)).toEqual([]);
    });

    it("returns an empty array for empty string input", () => {
        expect(parseStoredTags("")).toEqual([]);
    });

    it("parses a valid JSON array of strings", () => {
        expect(parseStoredTags('["tag1", "tag2"]')).toEqual(["tag1", "tag2"]);
    });

    it("filters out non-string elements", () => {
        expect(parseStoredTags('["tag1", 123, "tag2", null, {}, []]')).toEqual(["tag1", "tag2"]);
    });

    it("trims whitespace from strings", () => {
        expect(parseStoredTags('["  tag1  ", "tag2", "\\t tag3 \\n"]')).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("filters out empty strings or strings that become empty after trimming", () => {
        expect(parseStoredTags('["tag1", "", "  ", "tag2"]')).toEqual(["tag1", "tag2"]);
    });

    it("returns an empty array for valid JSON that is not an array", () => {
        expect(parseStoredTags('{"tag": "value"}')).toEqual([]);
        expect(parseStoredTags('"just a string"')).toEqual([]);
        expect(parseStoredTags('123')).toEqual([]);
    });

    it("returns an empty array for invalid JSON (catches the error)", () => {
        expect(parseStoredTags('invalid json')).toEqual([]);
        expect(parseStoredTags('["unclosed string')).toEqual([]);
    });
});
