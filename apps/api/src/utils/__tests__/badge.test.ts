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
        it("escapes special characters", () => {
            expect(escapeXml('a & b < c > d " e \' f')).toBe(
                "a &amp; b &lt; c &gt; d &quot; e &#39; f",
            );
        });
        it("handles empty strings", () => {
            expect(escapeXml("")).toBe("");
        });
        it("handles strings without special characters", () => {
            expect(escapeXml("hello world")).toBe("hello world");
        });
    });

    describe("normalizeBadgeStyle", () => {
        it("returns compact for compact input", () => {
            expect(normalizeBadgeStyle("compact")).toBe("compact");
        });
        it("returns default for other string inputs", () => {
            expect(normalizeBadgeStyle("flat")).toBe("default");
            expect(normalizeBadgeStyle("")).toBe("default");
        });
        it("returns default for null/undefined", () => {
            expect(normalizeBadgeStyle(null)).toBe("default");
            expect(normalizeBadgeStyle(undefined)).toBe("default");
        });
    });

    describe("normalizeBadgeLabel", () => {
        it("returns the label trimmed and whitespace-normalized", () => {
            expect(normalizeBadgeLabel("  hello   world  ")).toBe("hello world");
        });
        it("returns default label for empty, null, or undefined", () => {
            expect(normalizeBadgeLabel("")).toBe("OpenShelf");
            expect(normalizeBadgeLabel("   ")).toBe("OpenShelf");
            expect(normalizeBadgeLabel(null)).toBe("OpenShelf");
            expect(normalizeBadgeLabel(undefined)).toBe("OpenShelf");
        });
        it("truncates long labels", () => {
            const longLabel = "this is a very long label that exceeds the limit";
            const normalized = normalizeBadgeLabel(longLabel);
            expect(normalized.length).toBeLessThanOrEqual(24);
            expect(normalized.endsWith("…")).toBe(true);
        });
    });

    describe("normalizeBadgeColor", () => {
        it("returns lowercase standard hex colors without #", () => {
            expect(normalizeBadgeColor("FF0000")).toBe("ff0000");
            expect(normalizeBadgeColor("#00FF00")).toBe("00ff00");
            expect(normalizeBadgeColor("123")).toBe("123");
        });
        it("returns lowercase named colors", () => {
            expect(normalizeBadgeColor("Red")).toBe("red");
            expect(normalizeBadgeColor("blue")).toBe("blue");
        });
        it("returns default color for invalid, empty, null, or undefined", () => {
            expect(normalizeBadgeColor("invalid color!")).toBe("4c1");
            expect(normalizeBadgeColor("")).toBe("4c1");
            expect(normalizeBadgeColor(null)).toBe("4c1");
            expect(normalizeBadgeColor(undefined)).toBe("4c1");
        });
    });

    describe("truncateBadgeText", () => {
        it("does not truncate if within max length", () => {
            expect(truncateBadgeText("hello", 10)).toBe("hello");
            expect(truncateBadgeText("hello", 5)).toBe("hello");
        });
        it("truncates and adds ellipsis if exceeding max length", () => {
            expect(truncateBadgeText("hello world", 8)).toBe("hello w…");
        });
        it("handles max length <= 1", () => {
            expect(truncateBadgeText("hello", 1)).toBe("…");
            expect(truncateBadgeText("hello", 0)).toBe("…");
        });
        it("normalizes whitespace before truncating", () => {
            expect(truncateBadgeText("hello   world", 8)).toBe("hello w…");
        });
    });

    describe("estimateTextWidth", () => {
        it("estimates width for basic alphanumeric characters", () => {
            expect(estimateTextWidth("a")).toBe(6);
            expect(estimateTextWidth("A")).toBe(7);
            expect(estimateTextWidth("1")).toBe(6);
        });
        it("estimates width for wide characters", () => {
            expect(estimateTextWidth("あ")).toBe(11);
        });
        it("estimates width for emojis", () => {
            expect(estimateTextWidth("😀")).toBe(12);
        });
        it("estimates width for other characters (e.g., symbols, spaces)", () => {
            expect(estimateTextWidth(" ")).toBe(5);
            expect(estimateTextWidth("-")).toBe(5);
        });
        it("estimates total width", () => {
            expect(estimateTextWidth("aA1 あ😀 ")).toBe(52);
        });
    });

    describe("buildBadgeMessage", () => {
        it("returns 'Paper' for compact style", () => {
            expect(buildBadgeMessage("Some Title", 2024, "compact")).toBe("Paper");
        });
        it("includes title and year for default style", () => {
            expect(buildBadgeMessage("Some Title", 2024, "default")).toBe("Some Title (2024)");
        });
        it("omits year if null", () => {
            expect(buildBadgeMessage("Some Title", null, "default")).toBe("Some Title");
        });
        it("omits year if 0 (falsy check)", () => {
            expect(buildBadgeMessage("Some Title", 0, "default")).toBe("Some Title");
        });
        it("truncates long titles with year", () => {
            const title = "This is a very long title that should definitely be truncated";
            const message = buildBadgeMessage(title, 2024, "default");
            expect(message).toContain("… (2024)");
            expect(message.length).toBeLessThanOrEqual(35 + 7); // 35 for title + 7 for " (2024)"
        });
        it("truncates long titles without year", () => {
            const title = "This is a very long title that should definitely be truncated because it is long";
            const message = buildBadgeMessage(title, null, "default");
            expect(message).toContain("…");
            expect(message.length).toBeLessThanOrEqual(38);
        });
        it("returns 'Paper' if result is empty", () => {
            expect(buildBadgeMessage("   ", null, "default")).toBe("Paper");
        });
    });

    describe("buildLeftText", () => {
        it("prepends document emoji", () => {
            expect(buildLeftText("Label")).toBe("📄 Label");
        });
    });

    describe("buildBadgeSvg", () => {
        it("generates a valid SVG string", () => {
            const svg = buildBadgeSvg("left", "right", "ff0000");
            expect(svg).toContain("<svg");
            expect(svg).toContain("</svg>");
            expect(svg).toContain("left");
            expect(svg).toContain("right");
            expect(svg).toContain("#ff0000"); // color is transformed to hex
        });
        it("handles empty inputs by using defaults", () => {
            const svg = buildBadgeSvg("", "", "");
            expect(svg).toContain("📄 OpenShelf");
            expect(svg).toContain("Paper");
            expect(svg).toContain("#4c1");
        });
        it("handles named colors", () => {
            const svg = buildBadgeSvg("left", "right", "red");
            expect(svg).toContain(`fill="red"`);
        });
    });

    describe("buildShieldsEndpointPayload", () => {
        it("returns a Shields.io compatible payload", () => {
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
        it("returns SVG and JSON for not found badge", () => {
            const result = buildNotFoundBadge({
                style: "default",
                label: "MyLabel",
                color: "123", // color/style options are intentionally ignored; always uses NOT_FOUND_COLOR
            });
            expect(result.svg).toContain("📄 MyLabel");
            expect(result.svg).toContain("not found");
            expect(result.svg).toContain("#9f9f9f");

            expect(result.json).toEqual({
                schemaVersion: 1,
                label: "📄 MyLabel",
                message: "not found",
                color: "9f9f9f",
            });
        });
    });

    describe("createEtag", () => {
        it("generates a stable 16-character hex string enclosed in quotes", () => {
            const etag1 = createEtag("hello world");
            const etag2 = createEtag("hello world");
            expect(etag1).toBe(etag2);
            expect(etag1).toMatch(/^"[0-9a-f]{16}"$/);
        });
        it("generates different hashes for different inputs", () => {
            const etag1 = createEtag("hello world");
            const etag2 = createEtag("hello world!");
            expect(etag1).not.toBe(etag2);
        });
    });
});
