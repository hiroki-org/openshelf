import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { orgMembers, orgs } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { escapeLikeLiteral } from "../utils/sql";

const tagsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const TAG_SUGGEST_MIN_QUERY_LENGTH = 2;
const TAG_SUGGEST_MAX_QUERY_LENGTH = 100;
const TAG_SUGGEST_LIMIT = 20;

const SAFE_TAG_ARRAY_SQL = `
                CASE
                    WHEN json_valid(papers.tags) AND json_type(papers.tags) = 'array' THEN papers.tags
                    ELSE '[]'
                END
`;
const TRIMMED_TAG_SQL = "TRIM(json_each.value)";

// GET /api/tags/suggest?q=...&orgSlug=...
tagsRoute.get("/suggest", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("user").sub;
  const query = (c.req.query("q") ?? "").trim();
  const orgSlug = (c.req.query("orgSlug") ?? "").trim().toLowerCase();

  if (query.length < TAG_SUGGEST_MIN_QUERY_LENGTH) {
    return c.json({ tags: [] });
  }
  if (query.length > TAG_SUGGEST_MAX_QUERY_LENGTH) {
    return c.json({ error: "query too long" }, 400);
  }

  const normalizedQuery = escapeLikeLiteral(query.toLowerCase());

  let tags: string[] = [];

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

    const result = await c.env.DB.prepare(
      `
            SELECT
                ${TRIMMED_TAG_SQL} as tag,
                COUNT(*) as count
            FROM paper_orgs
            INNER JOIN papers ON paper_orgs.paper_id = papers.id
            LEFT JOIN paper_authors ON paper_authors.paper_id = papers.id AND paper_authors.user_id = ?1
            , json_each(${SAFE_TAG_ARRAY_SQL})
            WHERE paper_orgs.org_id = ?2
              AND typeof(json_each.value) = 'text'
              AND ${TRIMMED_TAG_SQL} != ''
              AND ${TRIMMED_TAG_SQL} LIKE ?3 || '%' ESCAPE '\\' COLLATE NOCASE
              AND (
                  papers.visibility = 'public'
                  OR papers.visibility = 'org_only'
                  OR (papers.visibility = 'private' AND paper_authors.user_id = ?1)
              )
            GROUP BY ${TRIMMED_TAG_SQL}
            ORDER BY count DESC, tag ASC
            LIMIT ?4
        `,
    )
      .bind(userId, org.id, normalizedQuery, TAG_SUGGEST_LIMIT)
      .all();
    tags = (result.results || []).map((r: any) => r.tag);
  } else {
    const result = await c.env.DB.prepare(
      `
            SELECT
                ${TRIMMED_TAG_SQL} as tag,
                COUNT(*) as count
            FROM papers
            INNER JOIN paper_authors ON paper_authors.paper_id = papers.id
            , json_each(${SAFE_TAG_ARRAY_SQL})
            WHERE paper_authors.user_id = ?1
              AND typeof(json_each.value) = 'text'
              AND ${TRIMMED_TAG_SQL} != ''
              AND ${TRIMMED_TAG_SQL} LIKE ?2 || '%' ESCAPE '\\' COLLATE NOCASE
            GROUP BY ${TRIMMED_TAG_SQL}
            ORDER BY count DESC, tag ASC
            LIMIT ?3
        `,
    )
      .bind(userId, normalizedQuery, TAG_SUGGEST_LIMIT)
      .all();
    tags = (result.results || []).map((r: any) => r.tag);
  }

  return c.json({ tags });
});

export default tagsRoute;
