import { describe, expect, it } from "vitest";
import {
    escapeXml,
    normalizeBadgeStyle,
    normalizeBadgeLabel,
    normalizeBadgeColor,
    truncateBadgeText,
    estimateTextWidth,
    buildBadgeMessage,
    buildLeftText,
    buildBadgeSvg,
    buildShieldsEndpointPayload,
    buildNotFoundBadge,
    createEtag,
} from "../badge";

describe("badge utils", () => {
    describe("escapeXml", () => {
        it("escapes special XML characters", () => {
            expect(escapeXml('some text < > & " \'')).toBe("some text &lt; &gt; &amp; &quot; &#39;");
            expect(escapeXml("normal text")).toBe("normal text");
        });
    });

    describe("normalizeBadgeStyle", () => {
        it('returns "compact" when value is "compact"', () => {
            expect(normalizeBadgeStyle("compact")).toBe("compact");
        });

        it('returns "default" for other values', () => {
            expect(normalizeBadgeStyle("default")).toBe("default");
            expect(normalizeBadgeStyle("flat")).toBe("default");
            expect(normalizeBadgeStyle(null)).toBe("default");
            expect(normalizeBadgeStyle(undefined)).toBe("default");
        });
    });

    describe("normalizeBadgeLabel", () => {
        it("returns default label if empty or null", () => {
            expect(normalizeBadgeLabel("")).toBe("OpenShelf");
            expect(normalizeBadgeLabel(null)).toBe("OpenShelf");
            expect(normalizeBadgeLabel(undefined)).toBe("OpenShelf");
            expect(normalizeBadgeLabel("   ")).toBe("OpenShelf");
        });

        it("truncates long labels to 24 characters", () => {
            const longLabel = "This is a very long label that should be truncated";
            const result = normalizeBadgeLabel(longLabel);
            expect(result).toBe("This is a very long lab…");
            expect(result.length).toBe(24);
        });

        it("cleans up whitespace", () => {
            expect(normalizeBadgeLabel("  hello   world  ")).toBe("hello world");
        });
    });

    describe("normalizeBadgeColor", () => {
        it("returns default color if empty or null", () => {
            expect(normalizeBadgeColor("")).toBe("4c1");
            expect(normalizeBadgeColor(null)).toBe("4c1");
            expect(normalizeBadgeColor(undefined)).toBe("4c1");
        });

        it("normalizes hex colors", () => {
            expect(normalizeBadgeColor("#FF0000")).toBe("ff0000");
            expect(normalizeBadgeColor("FFF")).toBe("fff");
            expect(normalizeBadgeColor("#12345678")).toBe("12345678");
        });

        it("normalizes named colors", () => {
            expect(normalizeBadgeColor("Red")).toBe("red");
            expect(normalizeBadgeColor("blue")).toBe("blue");
        });

        it("returns default color for invalid formats", () => {
            expect(normalizeBadgeColor("12")).toBe("4c1"); // Too short for hex
            expect(normalizeBadgeColor("invalid color format!")).toBe("4c1");
        });

        it("cleans up whitespace", () => {
            expect(normalizeBadgeColor("  #ff0000  ")).toBe("ff0000");
        });
    });

    describe("truncateBadgeText", () => {
        it("returns original text if shorter than max length", () => {
            expect(truncateBadgeText("hello", 10)).toBe("hello");
        });

        it("truncates text and appends ellipsis", () => {
            expect(truncateBadgeText("hello world", 5)).toBe("hell…");
        });

        it("handles empty string", () => {
            expect(truncateBadgeText("", 5)).toBe("");
        });

        it("returns ellipsis for maxLength 1 or less if text is longer", () => {
            expect(truncateBadgeText("hello", 1)).toBe("…");
            expect(truncateBadgeText("hello", 0)).toBe("…");
            expect(truncateBadgeText("hello", -1)).toBe("…");
        });

        it("handles wide characters properly (surrogate pairs)", () => {
            expect(truncateBadgeText("👨‍👩‍👧‍👦hello", 2)).toBe("👨…");
        });
    });

    describe("estimateTextWidth", () => {
        it("estimates width based on character types", () => {
            // Lowercase/numbers: 6
            expect(estimateTextWidth("a1")).toBe(12);
            // Uppercase: 7
            expect(estimateTextWidth("A")).toBe(7);
            // Emojis: 12
            expect(estimateTextWidth("🚀")).toBe(12);
            // Wide chars: 11
            expect(estimateTextWidth("한")).toBe(11);
            // Default (e.g. space): 5
            expect(estimateTextWidth(" ")).toBe(5);
        });
    });

    describe("buildBadgeMessage", () => {
        it('returns "Paper" if style is compact', () => {
            expect(buildBadgeMessage("My Paper Title", 2023, "compact")).toBe("Paper");
        });

        it("includes year and truncates appropriately", () => {
            // max length with year is 35
            const longTitle = "This is a very very long paper title that should definitely be truncated";
            const result = buildBadgeMessage(longTitle, 2023, "default");
            // "This is a very very long paper tit…" (34 chars) + " (2023)"
            expect(result).toBe("This is a very very long paper tit… (2023)");
        });

        it("truncates appropriately without year", () => {
            // max length without year is 38
            const longTitle = "This is a very very long paper title that should definitely be truncated";
            const result = buildBadgeMessage(longTitle, null, "default");
            expect(result).toBe("This is a very very long paper title …");
        });

        it("handles short titles", () => {
            expect(buildBadgeMessage("Short", 2023, "default")).toBe("Short (2023)");
            expect(buildBadgeMessage("Short", null, "default")).toBe("Short");
        });

        it('returns "Paper" if result is empty', () => {
            expect(buildBadgeMessage("   ", null, "default")).toBe("Paper");
        });
    });

    describe("buildLeftText", () => {
        it("prepends document emoji", () => {
            expect(buildLeftText("Label")).toBe("📄 Label");
        });
    });

    describe("buildBadgeSvg", () => {
        it("builds a valid SVG string", () => {
            const svg = buildBadgeSvg("left", "right", "ff0000");
            expect(svg).toContain("<svg");
            expect(svg).toContain("left");
            expect(svg).toContain("right");
            expect(svg).toContain("#ff0000"); // normalized svg color
        });

        it("uses default values if empty text", () => {
            const svg = buildBadgeSvg("", "", "");
            expect(svg).toContain("📄 OpenShelf"); // default left
            expect(svg).toContain("Paper"); // default right
            expect(svg).toContain("4c1"); // default color
        });

        it("escapes special XML characters in SVG", () => {
            const svg = buildBadgeSvg("<left>", "right&", "ff0000");
            expect(svg).toContain("&lt;left&gt;");
            expect(svg).toContain("right&amp;");
        });
    });

    describe("buildShieldsEndpointPayload", () => {
        it("builds payload with correct structure", () => {
            const payload = buildShieldsEndpointPayload("left", "right", "ff0000");
            expect(payload).toEqual({
                schemaVersion: 1,
                label: "left",
                message: "right",
                color: "ff0000",
            });
        });
    });

    describe("buildNotFoundBadge", () => {
        it("returns SVG and JSON for not found state", () => {
            const result = buildNotFoundBadge({ style: "default", label: "MyLabel", color: "ff0000" });

            // JSON checks
            expect(result.json.label).toBe("📄 MyLabel");
            expect(result.json.message).toBe("not found");
            expect(result.json.color).toBe("9f9f9f");

            // SVG checks
            expect(result.svg).toContain("📄 MyLabel");
            expect(result.svg).toContain("not found");
            expect(result.svg).toContain("9f9f9f");
        });
    });

    describe("createEtag", () => {
        it("creates a deterministic hash", () => {
            const etag1 = createEtag("test-string");
            const etag2 = createEtag("test-string");
            expect(etag1).toBe(etag2);
            expect(etag1).toMatch(/^"[0-9a-f]{16}"$/);
        });

        it("creates different hashes for different strings", () => {
            expect(createEtag("test1")).not.toBe(createEtag("test2"));
        });

        it("handles empty strings", () => {
            expect(createEtag("")).toMatch(/^"[0-9a-f]{16}"$/);
        });
    });
});
