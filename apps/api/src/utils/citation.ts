import type { CategoryType, VenueType } from "../db/schema";

export type CitationFormat =
    | "bibtex"
    | "biblatex"
    | "apa"
    | "ieee"
    | "mla"
    | "plain";

type CitationPaper = {
    id: string;
    title: string;
    venue: string | null;
    venueType: VenueType | null;
    year: number | null;
    category: CategoryType | null;
    doi: string | null;
    externalUrl: string | null;
};

type CitationAuthor = {
    name: string | null;
    displayName: string | null;
};

const STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "of",
    "on",
    "in",
    "for",
    "to",
    "and",
    "with",
    "by",
]);

function normalizeAscii(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .trim()
        .toLowerCase();
}

function escapeBibValue(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}");
}

function pickAuthorLabel(author: CitationAuthor): string {
    return author.displayName?.trim() || author.name?.trim() || "Unknown Author";
}

function pickSurname(author: CitationAuthor): string {
    const ascii = normalizeAscii(pickAuthorLabel(author));
    const tokens = ascii.split(/\s+/).filter(Boolean);
    return tokens[tokens.length - 1] || "author";
}

function pickTitleKeyWord(title: string): string {
    const tokens = normalizeAscii(title).split(/\s+/).filter(Boolean);
    return tokens.find((token) => !STOP_WORDS.has(token)) || tokens[0] || "paper";
}

function pickEntryType(paper: CitationPaper): "mastersthesis" | "inproceedings" | "article" | "techreport" | "misc" {
    if (paper.category === "thesis_bachelor") return "misc";
    if (paper.category === "thesis_master") return "mastersthesis";
    if (paper.category === "report") return "techreport";
    if (paper.venueType === "conference" || paper.venueType === "workshop") return "inproceedings";
    if (paper.venueType === "journal") return "article";
    return "misc";
}

function buildPaperUrl(frontendUrl: string, paper: CitationPaper): string {
    if (paper.externalUrl && /^https?:\/\//i.test(paper.externalUrl)) {
        return paper.externalUrl;
    }
    const base = frontendUrl.replace(/\/+$/, "");
    return `${base}/papers/${paper.id}`;
}


function toApaAuthorName(author: CitationAuthor): string {
    const label = pickAuthorLabel(author).trim();
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return label;

    const familyName = parts[parts.length - 1];
    const initials = parts
        .slice(0, -1)
        .map((part) => part.charAt(0).toUpperCase())
        .filter(Boolean)
        .join(". ");

    return initials ? `${familyName}, ${initials}.` : familyName;
}

function toBibLaTeXEntryTypeAndFields(
    entryType: ReturnType<typeof pickEntryType>,
): { entryType: string; extraFields: Array<[string, string]> } {
    if (entryType === "mastersthesis") {
        return {
            entryType: "thesis",
            extraFields: [["type", "Master's thesis"]],
        };
    }

    return { entryType, extraFields: [] };
}

function buildBibTexBody(
    entryType: string,
    key: string,
    paper: CitationPaper,
    authors: CitationAuthor[],
    frontendUrl: string,
    extraFields: Array<[string, string]> = [],
): string {
    const fields: Array<[string, string]> = [
        ["author", authors.map((author) => pickAuthorLabel(author)).join(" and ")],
        ["title", paper.title],
    ];

    if (paper.venue) {
        fields.push([
            entryType === "article" ? "journal" : "booktitle",
            paper.venue,
        ]);
    }
    if (paper.year) {
        fields.push(["year", String(paper.year)]);
    }
    if (paper.doi) {
        fields.push(["doi", paper.doi]);
    } else {
        fields.push(["url", buildPaperUrl(frontendUrl, paper)]);
    }

    fields.push(...extraFields);

    const body = fields
        .map(([name, value]) => `  ${name} = {${escapeBibValue(value)}}`)
        .join(",\n");

    return `@${entryType}{${key},\n${body}\n}`;
}

function buildPlainText(
    paper: CitationPaper,
    authors: CitationAuthor[],
    frontendUrl: string,
): string {
    const authorText = authors.map((author) => pickAuthorLabel(author)).join(", ");
    const yearText = paper.year ? `(${paper.year})` : "(n.d.)";
    const venueText = paper.venue ? ` ${paper.venue}.` : "";
    const locator = paper.doi ? ` https://doi.org/${paper.doi}` : ` ${buildPaperUrl(frontendUrl, paper)}`;
    return `${authorText}. ${yearText}. ${paper.title}.${venueText}${locator}`;
}

function buildApaText(
    paper: CitationPaper,
    authors: CitationAuthor[],
    frontendUrl: string,
): string {
    const authorText = authors.map((author) => toApaAuthorName(author)).join(", ");
    const yearText = paper.year ? `(${paper.year}).` : "(n.d.).";
    const venueText = paper.venue ? ` ${paper.venue}.` : "";
    const locator = paper.doi
        ? ` https://doi.org/${paper.doi}`
        : ` ${buildPaperUrl(frontendUrl, paper)}`;
    return `${authorText} ${yearText} ${paper.title}.${venueText}${locator}`;
}

function buildIeeeText(
    paper: CitationPaper,
    authors: CitationAuthor[],
    frontendUrl: string,
): string {
    const authorText = authors.map((author) => pickAuthorLabel(author)).join(", ");
    const yearText = paper.year ? String(paper.year) : "n.d.";
    const venueText = paper.venue ? `, ${paper.venue}` : "";
    const locator = paper.doi ? `, doi: ${paper.doi}` : `, ${buildPaperUrl(frontendUrl, paper)}`;
    return `${authorText}, "${paper.title}"${venueText}, ${yearText}${locator}.`;
}

function buildMlaText(
    paper: CitationPaper,
    authors: CitationAuthor[],
    frontendUrl: string,
): string {
    const authorText = authors.map((author) => pickAuthorLabel(author)).join(", ");
    const venueText = paper.venue ? `, ${paper.venue}` : "";
    const yearText = paper.year ? `, ${paper.year}` : "";
    const locator = paper.doi ? `. doi:${paper.doi}.` : `. ${buildPaperUrl(frontendUrl, paper)}.`;
    return `${authorText}. "${paper.title}"${venueText}${yearText}${locator}`;
}

export function buildCitation(
    paper: CitationPaper,
    authors: CitationAuthor[],
    format: CitationFormat,
    frontendUrl: string,
): { format: CitationFormat; citation: string; key: string | null } {
    const firstAuthor = authors[0] ?? { name: null, displayName: null };
    const key = `${pickSurname(firstAuthor)}${paper.year ?? "noyear"}${pickTitleKeyWord(paper.title)}`;
    const entryType = pickEntryType(paper);

    if (format === "bibtex") {
        return {
            format,
            citation: buildBibTexBody(entryType, key, paper, authors, frontendUrl),
            key,
        };
    }

    if (format === "biblatex") {
        const { entryType: bibLatexType, extraFields } = toBibLaTeXEntryTypeAndFields(entryType);
        return {
            format,
            citation: buildBibTexBody(
                bibLatexType,
                key,
                paper,
                authors,
                frontendUrl,
                extraFields,
            ),
            key,
        };
    }

    if (format === "plain") {
        return { format, citation: buildPlainText(paper, authors, frontendUrl), key: null };
    }

    if (format === "apa") {
        return { format, citation: buildApaText(paper, authors, frontendUrl), key: null };
    }

    if (format === "ieee") {
        return { format, citation: buildIeeeText(paper, authors, frontendUrl), key: null };
    }

    return { format, citation: buildMlaText(paper, authors, frontendUrl), key: null };
}

export function isCitationFormat(value: unknown): value is CitationFormat {
    return typeof value === "string" && ["bibtex", "biblatex", "apa", "ieee", "mla", "plain"].includes(value);
}
