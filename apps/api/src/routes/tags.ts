import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray } from "drizzle-orm";
import {
    orgMembers,
    orgs,
    paperAuthors,
    paperOrgs,
    papers,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { parseStoredTags } from "../utils/tags";

const tagsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const TAG_SUGGEST_MIN_QUERY_LENGTH = 2;
const TAG_SUGGEST_LIMIT = 20;

function compareTag(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

// GET /api/tags/suggest?q=...&orgSlug=...
tagsRoute.get("/suggest", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("user").sub;
    const query = (c.req.query("q") ?? "").trim();
    const orgSlug = (c.req.query("orgSlug") ?? "").trim().toLowerCase();

    if (query.length < TAG_SUGGEST_MIN_QUERY_LENGTH) {
        return c.json({ tags: [] });
    }

    let rows: Array<{ tags: string | null }> = [];
    if (orgSlug) {
        const org = await db
            .select({ id: orgs.id })
            .from(orgs)
            .where(eq(orgs.slug, orgSlug))
            .get();
        if (!org) return c.json({ error: "Org not found" }, 404);

        const membership = await db
            .select({ userId: orgMembers.userId })
            .from(orgMembers)
            .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, userId)))
            .get();
        if (!membership) return c.json({ error: "Forbidden" }, 403);

        const orgPaperRows = await db
            .select({ paperId: paperOrgs.paperId })
            .from(paperOrgs)
            .where(eq(paperOrgs.orgId, org.id))
            .all();
        if (orgPaperRows.length === 0) return c.json({ tags: [] });

        rows = await db
            .select({ tags: papers.tags })
            .from(papers)
            .where(inArray(papers.id, orgPaperRows.map((row) => row.paperId)))
            .all();
    } else {
        rows = await db
            .select({ tags: papers.tags })
            .from(papers)
            .innerJoin(
                paperAuthors,
                and(
                    eq(paperAuthors.paperId, papers.id),
                    eq(paperAuthors.userId, userId),
                ),
            )
            .all();
    }

    const normalizedQuery = query.toLowerCase();
    const counts = new Map<string, number>();
    for (const row of rows) {
        for (const tag of parseStoredTags(row.tags)) {
            if (!tag.toLowerCase().startsWith(normalizedQuery)) continue;
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }

    const tags = [...counts.entries()]
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return compareTag(a[0], b[0]);
        })
        .slice(0, TAG_SUGGEST_LIMIT)
        .map(([tag]) => tag);

    return c.json({ tags });
});

export default tagsRoute;
