import re

file_path = "apps/api/src/utils/__tests__/citation.test.ts"
with open(file_path, "r") as f:
    content = f.read()

# Remove the extra blank line before "formats IEEE output correctly"
content = content.replace("\n\n\n    it(\"formats IEEE output correctly\"", "\n\n    it(\"formats IEEE output correctly\"")

# Change the DOI test to be wrapped in a describe block
old_doi_test = """    it("uses doi field when doi exists across all formats", () => {
        const paperWithDoi = { ...paperBase, doi: "10.1145/xxxxxxx.xxxxxxx" };
        const authors = [{ name: "hiroki", displayName: "Hiroki Mukai" }];

        const bibtex = buildCitation(paperWithDoi, authors, "bibtex", "https://openshelf.example");
        expect(bibtex.citation).toContain("doi = {10.1145/xxxxxxx.xxxxxxx}");
        expect(bibtex.citation).not.toContain("url = {");

        const plain = buildCitation(paperWithDoi, authors, "plain", "https://openshelf.example");
        expect(plain.citation).toContain("https://doi.org/10.1145/xxxxxxx.xxxxxxx");

        const apa = buildCitation(paperWithDoi, authors, "apa", "https://openshelf.example");
        expect(apa.citation).toContain("https://doi.org/10.1145/xxxxxxx.xxxxxxx");

        const ieee = buildCitation(paperWithDoi, authors, "ieee", "https://openshelf.example");
        expect(ieee.citation).toContain("doi: 10.1145/xxxxxxx.xxxxxxx");

        const mla = buildCitation(paperWithDoi, authors, "mla", "https://openshelf.example");
        expect(mla.citation).toContain("doi:10.1145/xxxxxxx.xxxxxxx");
    });"""

new_doi_test = """    describe("when doi exists", () => {
        const paperWithDoi = { ...paperBase, doi: "10.1145/xxxxxxx.xxxxxxx" };
        const authors = [{ name: "hiroki", displayName: "Hiroki Mukai" }];

        it("uses doi for bibtex and omits url", () => {
            const bibtex = buildCitation(paperWithDoi, authors, "bibtex", "https://openshelf.example");
            expect(bibtex.citation).toContain("doi = {10.1145/xxxxxxx.xxxxxxx}");
            expect(bibtex.citation).not.toContain("url = {");
        });

        it("uses doi url for plain format", () => {
            const plain = buildCitation(paperWithDoi, authors, "plain", "https://openshelf.example");
            expect(plain.citation).toContain("https://doi.org/10.1145/xxxxxxx.xxxxxxx");
        });

        it("uses doi url for apa format", () => {
            const apa = buildCitation(paperWithDoi, authors, "apa", "https://openshelf.example");
            expect(apa.citation).toContain("https://doi.org/10.1145/xxxxxxx.xxxxxxx");
        });

        it("uses doi prefix for ieee format", () => {
            const ieee = buildCitation(paperWithDoi, authors, "ieee", "https://openshelf.example");
            expect(ieee.citation).toContain("doi: 10.1145/xxxxxxx.xxxxxxx");
        });

        it("uses doi prefix for mla format", () => {
            const mla = buildCitation(paperWithDoi, authors, "mla", "https://openshelf.example");
            expect(mla.citation).toContain("doi:10.1145/xxxxxxx.xxxxxxx");
        });
    });"""

content = content.replace(old_doi_test, new_doi_test)

with open(file_path, "w") as f:
    f.write(content)

print("Tests injected successfully.")
