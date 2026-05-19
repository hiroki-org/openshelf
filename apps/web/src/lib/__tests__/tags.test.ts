import { describe, expect, it } from "vitest";
import { splitTagInput, TAG_DELIMITER_PATTERN } from "../tags";

describe("splitTagInput", () => {
  it("splits tags by half-width comma, full-width comma, and Japanese comma", () => {
    expect(splitTagInput("AI, LLM，検索、推薦")).toEqual([
      "AI",
      "LLM",
      "検索",
      "推薦",
    ]);
  });

  it("trims surrounding whitespace and removes empty tags", () => {
    expect(splitTagInput(" AI , , LLM ， 、 検索 ")).toEqual([
      "AI",
      "LLM",
      "検索",
    ]);
  });

  it("keeps non-delimiter punctuation inside tag names", () => {
    expect(splitTagInput("R&D, vision-language, GraphQL/API")).toEqual([
      "R&D",
      "vision-language",
      "GraphQL/API",
    ]);
  });
});

describe("TAG_DELIMITER_PATTERN", () => {
  it("matches all supported delimiters", () => {
    expect([",", "，", "、"].every((delimiter) =>
      TAG_DELIMITER_PATTERN.test(delimiter),
    )).toBe(true);
  });
});
