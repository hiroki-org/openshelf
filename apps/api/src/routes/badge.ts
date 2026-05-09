import { Hono } from "hono";
import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { papers } from "../db/schema";
import type { Env, Variables } from "../types";
import {
  BADGE_CACHE_CONTROL,
  buildBadgeMessage,
  buildBadgeSvg,
  buildLeftText,
  buildNotFoundBadge,
  buildShieldsEndpointPayload,
  createEtag,
  normalizeBadgeColor,
  normalizeBadgeLabel,
  normalizeBadgeStyle,
} from "../utils/badge";

const badgeRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

type BadgeContext = Context<{ Bindings: Env; Variables: Variables }>;

function setCacheHeaders(c: BadgeContext, etag: string): void {
  c.header("Cache-Control", BADGE_CACHE_CONTROL);
  c.header("ETag", etag);
  c.header("Vary", "Accept-Encoding");
}

function normalizeEtagValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("W/") ? trimmed.slice(2).trim() : trimmed;
}

function applyConditionalResponse(c: BadgeContext, etag: string): boolean {
  const ifNoneMatch = c.req.header("If-None-Match");
  if (!ifNoneMatch) return false;

  const candidates = ifNoneMatch
    .split(",")
    .map((value) => normalizeEtagValue(value))
    .filter((value) => value.length > 0);

  if (candidates.includes("*") || candidates.includes(etag)) {
    setCacheHeaders(c, etag);
    c.status(304);
    return true;
  }
  return false;
}

async function fetchPublicPaper(
  c: BadgeContext,
  paperId: string,
): Promise<{
  id: string;
  title: string;
  year: number | null;
  visibility: string;
} | null> {
  const db = drizzle(c.env.DB);
  const paper = await db
    .select({
      id: papers.id,
      title: papers.title,
      year: papers.year,
      visibility: papers.visibility,
    })
    .from(papers)
    .where(eq(papers.id, paperId))
    .get();

  if (!paper || paper.visibility !== "public") return null;
  return paper;
}

function readBadgeOptions(c: BadgeContext) {
  const style = normalizeBadgeStyle(c.req.query("style"));
  const color = normalizeBadgeColor(c.req.query("color"));
  const label = normalizeBadgeLabel(c.req.query("label"));
  return { style, color, label };
}

badgeRoute.get("/:paperId", async (c) => {
  const paperId = c.req.param("paperId");
  const options = readBadgeOptions(c);
  const paper = await fetchPublicPaper(c, paperId);

  if (!paper) {
    const notFound = buildNotFoundBadge(options);
    const etag = createEtag(notFound.svg);
    if (applyConditionalResponse(c, etag)) {
      return c.body(null);
    }
    setCacheHeaders(c, etag);
    c.header("Content-Type", "image/svg+xml; charset=utf-8");
    return c.body(notFound.svg, 404);
  }

  const leftText = buildLeftText(options.label);
  const message = buildBadgeMessage(paper.title, paper.year, options.style);
  const svg = buildBadgeSvg(leftText, message, options.color);
  const etag = createEtag(svg);

  if (applyConditionalResponse(c, etag)) {
    return c.body(null);
  }
  setCacheHeaders(c, etag);
  c.header("Content-Type", "image/svg+xml; charset=utf-8");
  return c.body(svg);
});

badgeRoute.get("/api/:paperId", async (c) => {
  const paperId = c.req.param("paperId");
  const options = readBadgeOptions(c);
  const paper = await fetchPublicPaper(c, paperId);

  // This endpoint intentionally keeps shields.io-compatible JSON for both 200 and
  // 404 responses so external badge consumers can use the same contract.
  if (!paper) {
    const notFound = buildNotFoundBadge(options);
    const payload = JSON.stringify(notFound.json);
    const etag = createEtag(payload);
    if (applyConditionalResponse(c, etag)) {
      return c.body(null);
    }
    setCacheHeaders(c, etag);
    return c.json(notFound.json, 404);
  }

  const leftText = buildLeftText(options.label);
  const message = buildBadgeMessage(paper.title, paper.year, options.style);
  const json = buildShieldsEndpointPayload(leftText, message, options.color);
  const payload = JSON.stringify(json);
  const etag = createEtag(payload);
  if (applyConditionalResponse(c, etag)) {
    return c.body(null);
  }
  setCacheHeaders(c, etag);
  return c.json(json);
});

export default badgeRoute;
