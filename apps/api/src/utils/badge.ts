export type BadgeStyle = "default" | "compact";

export type BadgeOptions = {
  style: BadgeStyle;
  label: string;
  color: string;
};

export type ShieldsEndpointResponse = {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
};

const DEFAULT_LABEL = "OpenShelf";
const DEFAULT_COLOR = "4c1";
const NOT_FOUND_COLOR = "9f9f9f";
const BADGE_HEIGHT = 20;
const BADGE_PADDING_X = 10;
const MIN_SEGMENT_WIDTH = 24;
const MAX_LABEL_LENGTH = 24;
const MAX_TITLE_LENGTH_WITH_YEAR = 35;
const MAX_TITLE_LENGTH_WITHOUT_YEAR = 38;

export const BADGE_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=3600";

const WIDE_CHAR_REGEX =
  /[\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function toSafeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toSvgColor(color: string): string {
  return /^[0-9a-f]{3,8}$/i.test(color) ? `#${color}` : color;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeBadgeStyle(
  value: string | null | undefined,
): BadgeStyle {
  return value === "compact" ? "compact" : "default";
}

export function normalizeBadgeLabel(value: string | null | undefined): string {
  const normalized = toSafeText(value ?? "");
  if (!normalized) return DEFAULT_LABEL;
  return truncateBadgeText(normalized, MAX_LABEL_LENGTH);
}

export function normalizeBadgeColor(value: string | null | undefined): string {
  const normalized = toSafeText(value ?? "").replace(/^#/, "");
  if (!normalized) return DEFAULT_COLOR;
  if (/^[0-9a-f]{3,8}$/i.test(normalized)) return normalized.toLowerCase();
  if (/^[a-z]+$/i.test(normalized)) return normalized.toLowerCase();
  return DEFAULT_COLOR;
}

export function truncateBadgeText(value: string, maxLength: number): string {
  const chars = [...toSafeText(value)];
  if (chars.length <= maxLength) return chars.join("");
  if (maxLength <= 1) return "…";
  return `${chars.slice(0, maxLength - 1).join("")}…`;
}

export function estimateTextWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (EMOJI_REGEX.test(ch)) {
      width += 12;
      continue;
    }

    if (WIDE_CHAR_REGEX.test(ch)) {
      width += 11;
      continue;
    }

    if (/[A-Z]/.test(ch)) {
      width += 7;
      continue;
    }

    if (/[a-z0-9]/.test(ch)) {
      width += 6;
      continue;
    }

    width += 5;
  }

  return width;
}

export function buildBadgeMessage(
  title: string,
  year: number | null,
  style: BadgeStyle,
): string {
  if (style === "compact") return "Paper";
  const yearSuffix = year ? ` (${year})` : "";
  const maxTitleLength = year
    ? MAX_TITLE_LENGTH_WITH_YEAR
    : MAX_TITLE_LENGTH_WITHOUT_YEAR;
  const shortTitle = truncateBadgeText(title, maxTitleLength);
  const result = `${shortTitle}${yearSuffix}`.trim();
  return result || "Paper";
}

export function buildLeftText(label: string): string {
  return `📄 ${label}`;
}

export function buildBadgeSvg(
  leftTextRaw: string,
  rightTextRaw: string,
  rightColorRaw: string,
): string {
  const leftText = toSafeText(leftTextRaw) || buildLeftText(DEFAULT_LABEL);
  const rightText = toSafeText(rightTextRaw) || "Paper";
  const rightColor = toSvgColor(rightColorRaw || DEFAULT_COLOR);

  const leftWidth = Math.max(
    MIN_SEGMENT_WIDTH,
    Math.ceil(estimateTextWidth(leftText) + BADGE_PADDING_X * 2),
  );
  const rightWidth = Math.max(
    MIN_SEGMENT_WIDTH,
    Math.ceil(estimateTextWidth(rightText) + BADGE_PADDING_X * 2),
  );
  const totalWidth = leftWidth + rightWidth;

  const leftCenter = Math.round(leftWidth / 2);
  const rightCenter = leftWidth + Math.round(rightWidth / 2);
  const ariaLabel = `${leftText}: ${rightText}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(ariaLabel)}"><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".1" stop-color="#aaa" stop-opacity=".1"/><stop offset=".9" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient><mask id="m"><rect width="${totalWidth}" height="${BADGE_HEIGHT}" rx="3" fill="#fff"/></mask><g mask="url(#m)"><rect width="${leftWidth}" height="${BADGE_HEIGHT}" fill="#555"/><rect x="${leftWidth}" width="${rightWidth}" height="${BADGE_HEIGHT}" fill="${escapeXml(rightColor)}"/><rect width="${totalWidth}" height="${BADGE_HEIGHT}" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${leftCenter}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(leftText)}</text><text x="${leftCenter}" y="14">${escapeXml(leftText)}</text><text x="${rightCenter}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(rightText)}</text><text x="${rightCenter}" y="14">${escapeXml(rightText)}</text></g></svg>`;
}

export function buildShieldsEndpointPayload(
  leftText: string,
  rightText: string,
  color: string,
): ShieldsEndpointResponse {
  return {
    schemaVersion: 1,
    label: leftText,
    message: rightText,
    color,
  };
}

export function buildNotFoundBadge(options: BadgeOptions): {
  svg: string;
  json: ShieldsEndpointResponse;
} {
  const leftText = buildLeftText(options.label);
  const rightText = "not found";
  return {
    svg: buildBadgeSvg(leftText, rightText, NOT_FOUND_COLOR),
    json: buildShieldsEndpointPayload(leftText, rightText, NOT_FOUND_COLOR),
  };
}

export function createEtag(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const fnvPrime = 0x100000001b3n;
  const mask64 = 0xffffffffffffffffn;
  for (const ch of value) {
    hash ^= BigInt(ch.codePointAt(0) ?? 0);
    hash = (hash * fnvPrime) & mask64;
  }
  return `"${hash.toString(16).padStart(16, "0")}"`;
}
