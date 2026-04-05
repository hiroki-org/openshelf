import { describe, expect, it } from "vitest";
import { parseStoredTags } from "../tags";

describe("parseStoredTags", () => {
    it("returns an empty array for null input", () => {
      expect(parseStoredTags(null)).toEqual([]);
    });

    it("returns an empty array for an empty string", () => {
      expect(parseStoredTags("")).toEqual([]);
    });

    it("parses a valid JSON array of strings", () => {
      expect(parseStoredTags('["tag1", "tag2", "tag3"]')).toEqual([
        "tag1",
        "tag2",
        "tag3",
      ]);
    });

    it("trims whitespace from tags", () => {
      expect(parseStoredTags('[" tag1 ", "tag2  ", "  tag3"]')).toEqual([
        "tag1",
        "tag2",
        "tag3",
      ]);
    });

    it("filters out empty tags after trimming", () => {
      expect(parseStoredTags('["tag1", "", "  ", "tag2"]')).toEqual([
        "tag1",
        "tag2",
      ]);
    });

    it("filters out non-string items", () => {
      expect(parseStoredTags('["tag1", 42, null, {}, "tag2"]')).toEqual([
        "tag1",
        "tag2",
      ]);
    });

    it("returns an empty array if the parsed JSON is a plain object", () => {
      expect(parseStoredTags('{"tag": "value"}')).toEqual([]);
    });

    it("returns an empty array if the parsed JSON is a string", () => {
      expect(parseStoredTags('"just a string"')).toEqual([]);
    });

    it("returns an empty array if the parsed JSON is a number", () => {
      expect(parseStoredTags("42")).toEqual([]);
    });

    it("returns an empty array and catches errors for invalid JSON", () => {
      expect(parseStoredTags("invalid-json")).toEqual([]);
      expect(parseStoredTags('["unclosed", "array"')).toEqual([]);
    });

    it("returns an empty array for an empty JSON array", () => {
      expect(parseStoredTags("[]")).toEqual([]);
    });
});
