import { bench, describe } from "vitest";
import { buildCitation } from "../citation";

const benchmarkOptions = {
    time: 2000,
    warmupTime: 500,
    iterations: 25,
    warmupIterations: 10,
};

describe("citation benchmark", () => {
    const paperBase = {
        id: "paper-1",
        title: "Balance Boundary Explorer",
        venue: "ASE",
        venueType: "conference" as const,
        year: 2026,
        category: "other" as const,
        doi: "10.1145/xxxxxxx.xxxxxxx",
        externalUrl: null,
    };

    const authors = [
        { name: "hiroki", displayName: "Hiroki Mukai" },
        { name: "kato", displayName: "Yusaku Kato" },
    ];

    const frontendUrl = "https://openshelf.example";

    bench("buildCitation bibtex", () => {
        buildCitation(paperBase, authors, "bibtex", frontendUrl);
    }, benchmarkOptions);

    bench("buildCitation apa", () => {
        buildCitation(paperBase, authors, "apa", frontendUrl);
    }, benchmarkOptions);

    bench("buildCitation ieee", () => {
        buildCitation(paperBase, authors, "ieee", frontendUrl);
    }, benchmarkOptions);

    bench("buildCitation mla", () => {
        buildCitation(paperBase, authors, "mla", frontendUrl);
    }, benchmarkOptions);
});
