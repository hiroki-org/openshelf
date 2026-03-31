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

function setCacheHeaders(c: BadgeContext, payload: string): void {
    const etag = createEtag(payload);
    c.header("Cache-Control", BADGE_CACHE_CONTROL);
    c.header("ETag", etag);
    c.header("Vary", "Accept-Encoding");
}

function applyConditionalResponse(c: BadgeContext, payload: string): boolean {
    const etag = createEtag(payload);
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch && ifNoneMatch === etag) {
        c.header("Cache-Control", BADGE_CACHE_CONTROL);
        c.header("ETag", etag);
        c.header("Vary", "Accept-Encoding");
        c.status(304);
        return true;
    }
    return false;
}

async function fetchPublicPaper(
    c: BadgeContext,
    paperId: string,
) {
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
        if (applyConditionalResponse(c, notFound.svg)) {
            return c.body(null);
        }
        setCacheHeaders(c, notFound.svg);
        c.header("Content-Type", "image/svg+xml; charset=utf-8");
        return c.body(notFound.svg, 404);
    }

    const leftText = buildLeftText(options.label);
    const message = buildBadgeMessage(paper.title, paper.year, options.style);
    const svg = buildBadgeSvg(leftText, message, options.color);

    if (applyConditionalResponse(c, svg)) {
        return c.body(null);
    }
    setCacheHeaders(c, svg);
    c.header("Content-Type", "image/svg+xml; charset=utf-8");
    return c.body(svg);
});

badgeRoute.get("/api/:paperId", async (c) => {
    const paperId = c.req.param("paperId");
    const options = readBadgeOptions(c);
    const paper = await fetchPublicPaper(c, paperId);

    if (!paper) {
        const notFound = buildNotFoundBadge(options);
        const payload = JSON.stringify(notFound.json);
        if (applyConditionalResponse(c, payload)) {
            return c.body(null);
        }
        setCacheHeaders(c, payload);
        return c.json(notFound.json, 404);
    }

    const leftText = buildLeftText(options.label);
    const message = buildBadgeMessage(paper.title, paper.year, options.style);
    const json = buildShieldsEndpointPayload(leftText, message, options.color);
    const payload = JSON.stringify(json);
    if (applyConditionalResponse(c, payload)) {
        return c.body(null);
    }
    setCacheHeaders(c, payload);
    return c.json(json);
});

export default badgeRoute;
