import { describe, expect, it } from "vitest";
import { buildCitation } from "../citation";

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
        expect(result.citation).toContain("author = {Hiroki Mukai and Yusaku Kato}");
        expect(result.citation).toContain("url = {https://openshelf.example/papers/paper-1}");
    });

    it("uses doi field when doi exists", () => {
        const result = buildCitation(
            { ...paperBase, doi: "10.1145/xxxxxxx.xxxxxxx" },
            [{ name: "hiroki", displayName: "Hiroki Mukai" }],
            "bibtex",
            "https://openshelf.example",
        );

        expect(result.citation).toContain("doi = {10.1145/xxxxxxx.xxxxxxx}");
        expect(result.citation).not.toContain("url = {");
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
        expect(result.citation).toContain("type = {Master\'s thesis}");
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

});
