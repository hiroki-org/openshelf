import { describe, expect, it } from "vitest";
import { buildCitation, isCitationFormat } from "../citation";

describe("buildCitation", () => {
  const paperBase = {
    id: "paper-1",
    title: "Balance Boundary Explorer",
    venue: "ASE",
    venueType: "conference" as const,
    year: 2026,
    category: "other" as const,
    doi: null,
    externalUrl: null,
  };

  it("generates bibtex with key and fallback url when doi is missing", () => {
    const result = buildCitation(
      paperBase,
      [
        { name: "hiroki", displayName: "Hiroki Mukai" },
        { name: "kato", displayName: "Yusaku Kato" },
      ],
      "bibtex",
      "https://openshelf.example",
    );

    expect(result.format).toBe("bibtex");
    expect(result.key).toBe("mukai2026balance");
    expect(result.citation).toContain("@inproceedings{mukai2026balance");
    expect(result.citation).toContain(
      "author = {Hiroki Mukai and Yusaku Kato}",
    );
    expect(result.citation).toContain(
      "url = {https://openshelf.example/papers/paper-1}",
    );
  });

  describe("when doi exists", () => {
    const paperWithDoi = { ...paperBase, doi: "10.1145/xxxxxxx.xxxxxxx" };
    const authors = [{ name: "hiroki", displayName: "Hiroki Mukai" }];

    it("uses doi for bibtex and omits url", () => {
      const bibtex = buildCitation(
        paperWithDoi,
        authors,
        "bibtex",
        "https://openshelf.example",
      );
      expect(bibtex.citation).toContain("doi = {10.1145/xxxxxxx.xxxxxxx}");
      expect(bibtex.citation).not.toContain("url = {");
    });

    it("uses doi url for plain format", () => {
      const plain = buildCitation(
        paperWithDoi,
        authors,
        "plain",
        "https://openshelf.example",
      );
      expect(plain.citation).toContain(
        "https://doi.org/10.1145/xxxxxxx.xxxxxxx",
      );
    });

    it("uses doi url for apa format", () => {
      const apa = buildCitation(
        paperWithDoi,
        authors,
        "apa",
        "https://openshelf.example",
      );
      expect(apa.citation).toContain("https://doi.org/10.1145/xxxxxxx.xxxxxxx");
    });

    it("uses doi prefix for ieee format", () => {
      const ieee = buildCitation(
        paperWithDoi,
        authors,
        "ieee",
        "https://openshelf.example",
      );
      expect(ieee.citation).toContain("doi: 10.1145/xxxxxxx.xxxxxxx");
    });

    it("uses doi prefix for mla format", () => {
      const mla = buildCitation(
        paperWithDoi,
        authors,
        "mla",
        "https://openshelf.example",
      );
      expect(mla.citation).toContain("doi:10.1145/xxxxxxx.xxxxxxx");
    });
  });

  it("supports plain format output", () => {
    const result = buildCitation(
      paperBase,
      [{ name: "hiroki", displayName: "向井 宏樹" }],
      "plain",
      "https://openshelf.example",
    );

    expect(result.format).toBe("plain");
    expect(result.key).toBeNull();
    expect(result.citation).toContain("向井 宏樹");
    expect(result.citation).toContain("Balance Boundary Explorer");
  });

  it("maps category and venue type to expected bibtex entry type", () => {
    const bachelor = buildCitation(
      { ...paperBase, category: "thesis_bachelor", venueType: null },
      [{ name: "a", displayName: "Alice" }],
      "bibtex",
      "https://openshelf.example",
    );
    const master = buildCitation(
      { ...paperBase, category: "thesis_master", venueType: null },
      [{ name: "a", displayName: "Alice" }],
      "bibtex",
      "https://openshelf.example",
    );
    const journal = buildCitation(
      { ...paperBase, category: "other", venueType: "journal", venue: "JSS" },
      [{ name: "a", displayName: "Alice" }],
      "bibtex",
      "https://openshelf.example",
    );
    const report = buildCitation(
      { ...paperBase, category: "report", venueType: null, venue: null },
      [{ name: "a", displayName: "Alice" }],
      "bibtex",
      "https://openshelf.example",
    );

    expect(bachelor.citation).toContain("@misc{");
    expect(master.citation).toContain("@mastersthesis{");
    expect(journal.citation).toContain("@article{");
    expect(report.citation).toContain("@techreport{");
  });

  it("emits biblatex-specific thesis entry metadata for thesis_master", () => {
    const result = buildCitation(
      { ...paperBase, category: "thesis_master", venueType: null, venue: null },
      [{ name: "hiroki", displayName: "Hiroki Mukai" }],
      "biblatex",
      "https://openshelf.example",
    );

    expect(result.citation).toContain("@thesis{");
    expect(result.citation).toContain("type = {Master's thesis}");
  });

  it("formats APA output with surname-initial style", () => {
    const result = buildCitation(
      paperBase,
      [
        { name: "hiroki", displayName: "Hiroki Mukai" },
        { name: "kato", displayName: "Yusaku Kato" },
      ],
      "apa",
      "https://openshelf.example",
    );

    expect(result.citation).toContain("Mukai, H.");
    expect(result.citation).toContain("Kato, Y.");
    expect(result.citation).toContain("(2026).");
  });

  it("formats IEEE output correctly", () => {
    const result = buildCitation(
      paperBase,
      [
        { name: "hiroki", displayName: "Hiroki Mukai" },
        { name: "kato", displayName: "Yusaku Kato" },
      ],
      "ieee",
      "https://openshelf.example",
    );

    expect(result.format).toBe("ieee");
    expect(result.key).toBeNull();
    expect(result.citation).toContain("Hiroki Mukai, Yusaku Kato");
    expect(result.citation).toContain(
      '"Balance Boundary Explorer", ASE, 2026, https://openshelf.example/papers/paper-1.',
    );
  });

  it("formats MLA output correctly", () => {
    const result = buildCitation(
      paperBase,
      [
        { name: "hiroki", displayName: "Hiroki Mukai" },
        { name: "kato", displayName: "Yusaku Kato" },
      ],
      "mla",
      "https://openshelf.example",
    );

    expect(result.format).toBe("mla");
    expect(result.key).toBeNull();
    expect(result.citation).toContain("Hiroki Mukai, Yusaku Kato.");
    expect(result.citation).toContain(
      '"Balance Boundary Explorer", ASE, 2026. https://openshelf.example/papers/paper-1.',
    );
  });
});

describe("isCitationFormat", () => {
  const validFormats = [
    "bibtex",
    "biblatex",
    "apa",
    "ieee",
    "mla",
    "plain",
  ] as const;

  it.each(validFormats)("returns true for valid format: %s", (format) => {
    expect(isCitationFormat(format)).toBe(true);
  });

  it.each([
    "chicago",
    "BIBTEX",
    "",
    "unknown",
    "bibtex ",
    null,
    undefined,
    123,
    true,
    false,
    {},
    [],
    Symbol("test"),
  ] satisfies unknown[])("returns false for invalid format: %s", (format) => {
    expect(isCitationFormat(format)).toBe(false);
  });
});
