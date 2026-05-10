import { Hono, type Context } from "hono";
import { verify } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, inArray, desc, or, isNotNull } from "drizzle-orm";
import {
  orgs,
  orgMembers,
  paperOrgs,
  papers,
  paperAuthors,
  users,
  enableForeignKeys,
  touchUpdatedAt,
  VALID_CATEGORIES,
  type CategoryType,
} from "../db/schema";
import type { Env, JwtPayload, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { parseStoredTags } from "../utils/tags";
import { ID_MAX_LENGTH } from "../utils/constants";

const orgsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();
const ORG_TAGS_LIMIT = 100;
const ORG_PAPERS_PAGE_SIZE = 20;

function normalizeFilterValue(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function isValidCategory(value: string): value is CategoryType {
  return VALID_CATEGORIES.includes(value as CategoryType);
}

function normalizeBoundedId(
  value: unknown,
  field: string,
): { value?: string; error?: string } {
  if (typeof value !== "string") return { error: `${field} is required` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required` };
  if (trimmed.length > ID_MAX_LENGTH) {
    return { error: `${field} must be ${ID_MAX_LENGTH} characters or less` };
  }
  return { value: trimmed };
}

function buildOrgPapersVisibilityCondition(
  isMember: boolean,
  authoredIds: string[],
) {
  if (isMember) {
    if (authoredIds.length > 0) {
      return or(
        eq(papers.visibility, "public"),
        eq(papers.visibility, "org_only"),
        and(eq(papers.visibility, "private"), inArray(papers.id, authoredIds)),
      );
    }
    return or(
      eq(papers.visibility, "public"),
      eq(papers.visibility, "org_only"),
    );
  }

  if (authoredIds.length > 0) {
    return or(
      eq(papers.visibility, "public"),
      and(eq(papers.visibility, "org_only"), inArray(papers.id, authoredIds)),
      and(eq(papers.visibility, "private"), inArray(papers.id, authoredIds)),
    );
  }

  return eq(papers.visibility, "public");
}

function hasJwtSub(value: unknown): value is Pick<JwtPayload, "sub"> {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { sub?: unknown }).sub === "string"
  );
}

const MEMBER_ROLES = ["admin", "member"] as const;

const escapeLikeLiteral = (str: string) => {
  return str.replace(/[\\%_]/g, "\\$&");
};

type MemberRole = (typeof MEMBER_ROLES)[number];
function isMemberRole(role: unknown): role is MemberRole {
  return (
    typeof role === "string" &&
    (MEMBER_ROLES as readonly string[]).includes(role)
  );
}

const ADMIN_LIKE_ROLES = ["admin", "owner"] as const;
type AdminLikeRole = (typeof ADMIN_LIKE_ROLES)[number];
function isAdminLikeRole(role: unknown): role is AdminLikeRole {
  return (
    typeof role === "string" &&
    (ADMIN_LIKE_ROLES as readonly string[]).includes(role)
  );
}

// ─── Validation helpers ─────────────────────────────────────────
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function validateSlug(slug: unknown): string | null {
  if (typeof slug !== "string") return "slug is required";
  const s = slug.trim().toLowerCase();
  if (s.length < 3 || s.length > 40) return "slug must be 3–40 characters";
  if (!SLUG_RE.test(s))
    return "slug must contain only lowercase letters, numbers, and hyphens";
  if (s.includes("--")) return "slug must not contain consecutive hyphens";
  return null;
}

function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length === 0)
    return "name is required";
  if (name.trim().length > 100) return "name must be 100 characters or less";
  return null;
}

function validateDescription(description: unknown): string | null {
  if (description === undefined || description === null || description === "")
    return null;
  if (typeof description !== "string") return "description must be a string";
  if (description.trim().length > 500)
    return "description must be 500 characters or less";
  return null;
}

// ─── Permission helpers ─────────────────────────────────────────
async function getOrgBySlug(db: ReturnType<typeof drizzle>, slug: string) {
  return db.select().from(orgs).where(eq(orgs.slug, slug)).get();
}

async function getOrgMembership(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  userId: string,
) {
  return db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .get();
}

async function requireOrgAdmin(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  userId: string,
) {
  const membership = await getOrgMembership(db, orgId, userId);
  if (!membership || !isAdminLikeRole(membership.role)) {
    return { ok: false as const, error: "Forbidden: admin access required" };
  }
  return { ok: true as const, membership };
}

async function isOrgMember(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const membership = await getOrgMembership(db, orgId, userId);
  return !!membership;
}

async function isPaperAuthor(
  db: ReturnType<typeof drizzle>,
  paperId: string,
  userId: string,
): Promise<boolean> {
  const author = await db
    .select()
    .from(paperAuthors)
    .where(
      and(eq(paperAuthors.paperId, paperId), eq(paperAuthors.userId, userId)),
    )
    .get();
  return !!author;
}

async function getOptionalUserIdFromAuthHeader(
  c: Context<{ Bindings: Env; Variables: Variables }>,
): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const payload = await verify(
      authHeader.slice(7),
      c.env.JWT_SECRET,
      "HS256",
    );
    return hasJwtSub(payload) ? payload.sub : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. Org CRUD
// ═══════════════════════════════════════════════════════════════

// GET /api/orgs/:slug/tags — list tags used in an org
orgsRoute.get("/:slug/tags", async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);
  const query = (c.req.query("q") ?? "").trim().toLowerCase();

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  // Optional auth to determine whether org_only/private tags should be visible
  const currentUserId = await getOptionalUserIdFromAuthHeader(c);

  const isMember = currentUserId
    ? await isOrgMember(db, org.id, currentUserId)
    : false;

  const orgPapers = currentUserId
    ? await db
        .select({
          id: papers.id,
          visibility: papers.visibility,
          tags: papers.tags,
          authorUserId: paperAuthors.userId,
        })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .leftJoin(
          paperAuthors,
          and(
            eq(paperAuthors.paperId, papers.id),
            eq(paperAuthors.userId, currentUserId),
          ),
        )
        .where(eq(paperOrgs.orgId, org.id))
        .all()
    : await db
        .select({
          id: papers.id,
          visibility: papers.visibility,
          tags: papers.tags,
          authorUserId: sql<string | null>`null`,
        })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(eq(paperOrgs.orgId, org.id))
        .all();
  if (orgPapers.length === 0) return c.json({ tags: [] });

  const counts = new Map<string, number>();
  const tagCache = new Map<string, string[]>();
  const lowerCache = new Map<string, string>();

  for (const paper of orgPapers) {
    const isAuthor = paper.authorUserId === currentUserId;
    const isVisible =
      paper.visibility === "public" ||
      (paper.visibility === "org_only" && (isMember || isAuthor)) ||
      (paper.visibility === "private" && isAuthor);
    if (!isVisible) continue;

    const rawTags = paper.tags ?? "";
    let tags = tagCache.get(rawTags);
    if (tags === undefined) {
      tags = parseStoredTags(rawTags);
      tagCache.set(rawTags, tags);
    }

    for (const tag of tags) {
      if (query) {
        let lower = lowerCache.get(tag);
        if (lower === undefined) {
          lower = tag.toLowerCase();
          lowerCache.set(tag, lower);
        }
        if (!lower.startsWith(query)) continue;
      }
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const tags = [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, ORG_TAGS_LIMIT)
    .map(([tag]) => tag);

  return c.json({ tags });
});

// POST /api/orgs — create org
orgsRoute.post("/", authMiddleware, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type CreateOrgBody = {
    slug?: unknown;
    name?: unknown;
    description?: unknown;
  };
  const payload = body as CreateOrgBody;

  const slugErr = validateSlug(payload.slug);
  if (slugErr) return c.json({ error: slugErr }, 400);
  const nameErr = validateName(payload.name);
  if (nameErr) return c.json({ error: nameErr }, 400);
  const descErr = validateDescription(payload.description);
  if (descErr) return c.json({ error: descErr }, 400);

  const slug = (payload.slug as string).trim().toLowerCase();
  const name = (payload.name as string).trim();
  const description = payload.description
    ? (payload.description as string).trim() || null
    : null;

  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  // Check slug uniqueness
  const existing = await getOrgBySlug(db, slug);
  if (existing) return c.json({ error: "slug already in use" }, 409);

  const orgId = crypto.randomUUID();

  try {
    await db.insert(orgs).values({
      id: orgId,
      slug,
      name,
      description,
      ...touchUpdatedAt(),
    });

    // Creator becomes admin
    await db.insert(orgMembers).values({
      orgId,
      userId,
      role: "admin",
    });
  } catch (err: unknown) {
    // Handle race condition: UNIQUE constraint violation
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return c.json({ error: "slug already in use" }, 409);
    }
    throw err;
  }

  const org = await db.select().from(orgs).where(eq(orgs.id, orgId)).get();
  return c.json({ org }, 201);
});

// GET /api/orgs/:slug — org detail
orgsRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const [memberCount, paperCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(orgMembers)
      .where(eq(orgMembers.orgId, org.id))
      .get(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(paperOrgs)
      .where(eq(paperOrgs.orgId, org.id))
      .get(),
  ]);

  return c.json({
    org,
    memberCount: memberCount?.count ?? 0,
    paperCount: paperCount?.count ?? 0,
  });
});

// PATCH /api/orgs/:slug — update org
orgsRoute.patch("/:slug", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const adminCheck = await requireOrgAdmin(db, org.id, userId);
  if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type UpdateOrgBody = {
    name?: unknown;
    slug?: unknown;
    description?: unknown;
  };
  const payload = body as UpdateOrgBody;

  const updates: Record<string, any> = {};

  if (payload.name !== undefined) {
    const nameErr = validateName(payload.name);
    if (nameErr) return c.json({ error: nameErr }, 400);
    updates.name = (payload.name as string).trim();
  }

  if (payload.slug !== undefined) {
    const slugErr = validateSlug(payload.slug);
    if (slugErr) return c.json({ error: slugErr }, 400);
    const newSlug = (payload.slug as string).trim().toLowerCase();
    if (newSlug !== org.slug) {
      const existing = await getOrgBySlug(db, newSlug);
      if (existing) return c.json({ error: "slug already in use" }, 409);
      updates.slug = newSlug;
    }
  }

  if (payload.description !== undefined) {
    const descErr = validateDescription(payload.description);
    if (descErr) return c.json({ error: descErr }, 400);
    updates.description = payload.description
      ? (payload.description as string).trim()
      : null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  await db.update(orgs).set(updates).where(eq(orgs.id, org.id));
  const updated = await db.select().from(orgs).where(eq(orgs.id, org.id)).get();
  return c.json({ org: updated });
});

// DELETE /api/orgs/:slug — delete org
orgsRoute.delete("/:slug", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const adminCheck = await requireOrgAdmin(db, org.id, userId);
  if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

  // CASCADE will delete org_members and paper_orgs
  await db.delete(orgs).where(eq(orgs.id, org.id));
  return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// 2. Member management
// ═══════════════════════════════════════════════════════════════

// GET /api/orgs/:slug/members — member list
orgsRoute.get("/:slug/members", async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const members = await db
    .select({
      userId: orgMembers.userId,
      role: orgMembers.role,
      name: users.name,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      githubId: users.githubId,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, org.id))
    .all();

  return c.json({ members });
});

// POST /api/orgs/:slug/members — add member
orgsRoute.post("/:slug/members", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const adminCheck = await requireOrgAdmin(db, org.id, userId);
  if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type AddMemberBody = {
    userId?: unknown;
    role?: unknown;
  };
  const payload = body as AddMemberBody;

  const targetUserIdResult = normalizeBoundedId(payload.userId, "userId");
  if (targetUserIdResult.error) {
    return c.json({ error: targetUserIdResult.error }, 400);
  }
  const targetUserId = targetUserIdResult.value as string;

  const rawRole = payload.role ?? "member";
  if (!isMemberRole(rawRole)) {
    return c.json({ error: "role must be 'admin' or 'member'" }, 400);
  }
  const role = rawRole as "admin" | "member";

  // Check user exists
  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .get();
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  // Check not already a member
  const existing = await getOrgMembership(db, org.id, targetUserId);
  if (existing) return c.json({ error: "User is already a member" }, 409);

  try {
    await db.insert(orgMembers).values({
      orgId: org.id,
      userId: targetUserId,
      role,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return c.json({ error: "User is already a member" }, 409);
    }
    throw err;
  }

  return c.json({ ok: true }, 201);
});

// PATCH /api/orgs/:slug/members/:userId — change role
orgsRoute.patch("/:slug/members/:userId", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const targetUserIdResult = normalizeBoundedId(
    c.req.param("userId"),
    "userId",
  );
  if (targetUserIdResult.error) {
    return c.json({ error: targetUserIdResult.error }, 400);
  }
  const targetUserId = targetUserIdResult.value as string;
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const adminCheck = await requireOrgAdmin(db, org.id, userId);
  if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type UpdateMemberBody = {
    role?: unknown;
  };
  const payload = body as UpdateMemberBody;

  const membership = await getOrgMembership(db, org.id, targetUserId);
  if (!membership) return c.json({ error: "Member not found" }, 404);

  if (adminCheck.membership.role === "admin" && membership.role === "owner") {
    return c.json({ error: "Forbidden: admin cannot modify owner role" }, 403);
  }

  const rawRole = payload.role;
  if (!isMemberRole(rawRole)) {
    return c.json({ error: "role must be 'admin' or 'member'" }, 400);
  }
  const newRole = rawRole as "admin" | "member";

  // Prevent demoting the last admin purely via atomic update check
  if (newRole === "member" && isAdminLikeRole(membership.role)) {
    const result = await db
      .update(orgMembers)
      .set({ role: newRole })
      .where(
        and(
          eq(orgMembers.orgId, org.id),
          eq(orgMembers.userId, targetUserId),
          sql`(SELECT count(*) FROM ${orgMembers} WHERE ${orgMembers.orgId} = ${org.id} AND (${orgMembers.role} = 'admin' OR ${orgMembers.role} = 'owner')) > 1`,
        ),
      );

    if (result.meta.changes === 0) {
      return c.json({ error: "Cannot demote the last admin" }, 400);
    }
    return c.json({ ok: true });
  }

  await db
    .update(orgMembers)
    .set({ role: newRole })
    .where(
      and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUserId)),
    );

  return c.json({ ok: true });
});

// DELETE /api/orgs/:slug/members/:userId — remove member
orgsRoute.delete("/:slug/members/:userId", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const targetUserIdResult = normalizeBoundedId(
    c.req.param("userId"),
    "userId",
  );
  if (targetUserIdResult.error) {
    return c.json({ error: targetUserIdResult.error }, 400);
  }
  const targetUserId = targetUserIdResult.value as string;
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  const adminCheck = await requireOrgAdmin(db, org.id, userId);
  if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

  const membership = await getOrgMembership(db, org.id, targetUserId);
  if (!membership) return c.json({ error: "Member not found" }, 404);

  if (adminCheck.membership.role === "admin" && membership.role === "owner") {
    return c.json({ error: "Forbidden: admin cannot remove owner" }, 403);
  }

  // Prevent removing the last admin purely via atomic delete check
  if (isAdminLikeRole(membership.role)) {
    const result = await db
      .delete(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, org.id),
          eq(orgMembers.userId, targetUserId),
          sql`(SELECT count(*) FROM ${orgMembers} WHERE ${orgMembers.orgId} = ${org.id} AND (${orgMembers.role} = 'admin' OR ${orgMembers.role} = 'owner')) > 1`,
        ),
      );

    if (result.meta.changes === 0) {
      return c.json({ error: "Cannot remove the last admin" }, 400);
    }
    return c.json({ ok: true });
  }

  await db
    .delete(orgMembers)
    .where(
      and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUserId)),
    );

  return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// 3. Paper ↔ Org association
// ═══════════════════════════════════════════════════════════════

// GET /api/orgs/:slug/papers — papers in org (with visibility filter)
orgsRoute.get("/:slug/papers", async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);
  const yearQuery = normalizeFilterValue(c.req.query("year"));
  const venueQuery = normalizeFilterValue(c.req.query("venue"));
  const categoryQuery = normalizeFilterValue(c.req.query("category"));
  const pageQuery = c.req.query("page");
  // year=all は autoYear(最新年度自動選択) を明示的に無効化して全年度表示するために使う
  const paginate = c.req.query("paginate") === "1";
  const autoYear = c.req.query("autoYear") === "1";

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  let page = 1;
  if (pageQuery !== undefined) {
    if (!/^\d+$/.test(pageQuery)) {
      return c.json({ error: "Invalid page" }, 400);
    }
    page = Number.parseInt(pageQuery, 10);
    if (!Number.isFinite(page) || page <= 0) {
      return c.json({ error: "Invalid page" }, 400);
    }
  }

  if (venueQuery && venueQuery.length > 100) {
    return c.json({ error: "venue must be 100 characters or less" }, 400);
  }

  if (categoryQuery && !isValidCategory(categoryQuery)) {
    return c.json({ error: "Invalid category" }, 400);
  }
  const categoryFilter = categoryQuery as CategoryType | null;

  let requestedYear: number | null = null;
  const wantsAllYears = yearQuery === "all";
  if (yearQuery && !wantsAllYears) {
    if (!/^\d{4}$/.test(yearQuery)) {
      return c.json({ error: "Invalid year" }, 400);
    }
    const parsedYear = Number.parseInt(yearQuery, 10);
    if (
      !Number.isFinite(parsedYear) ||
      parsedYear < 1900 ||
      parsedYear > 2100
    ) {
      return c.json({ error: "Invalid year" }, 400);
    }
    requestedYear = parsedYear;
  }

  // Check auth (optional)
  const currentUserId = await getOptionalUserIdFromAuthHeader(c);

  const isMember = currentUserId
    ? await isOrgMember(db, org.id, currentUserId)
    : false;
  const authoredIds = currentUserId
    ? (
        await db
          .select({ paperId: paperAuthors.paperId })
          .from(paperOrgs)
          .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
          .innerJoin(
            paperAuthors,
            and(
              eq(paperAuthors.paperId, papers.id),
              eq(paperAuthors.userId, currentUserId),
            ),
          )
          .where(eq(paperOrgs.orgId, org.id))
          .all()
      ).map((r) => r.paperId)
    : [];
  const visibilityCondition = buildOrgPapersVisibilityCondition(
    isMember,
    authoredIds,
  );

  const baseFilters = [eq(paperOrgs.orgId, org.id), visibilityCondition];

  let effectiveYear = requestedYear;
  const latestYearFilters = [...baseFilters];
  if (venueQuery) {
    latestYearFilters.push(
      sql`${papers.venue} LIKE ${`%${escapeLikeLiteral(venueQuery)}%`} ESCAPE '\\'`,
    );
  }
  if (categoryFilter) {
    latestYearFilters.push(eq(papers.category, categoryFilter));
  }

  if (autoYear && !wantsAllYears && requestedYear === null) {
    const latestYearRow = await db
      .select({ maxYear: sql<number | null>`MAX(${papers.year})` })
      .from(paperOrgs)
      .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
      .where(and(...latestYearFilters))
      .get();
    effectiveYear = latestYearRow?.maxYear ?? null;
  }

  const finalFilters = [...baseFilters];
  if (venueQuery) {
    finalFilters.push(
      sql`${papers.venue} LIKE ${`%${escapeLikeLiteral(venueQuery)}%`} ESCAPE '\\'`,
    );
  }
  if (categoryFilter) {
    finalFilters.push(eq(papers.category, categoryFilter));
  }
  if (effectiveYear !== null) {
    finalFilters.push(eq(papers.year, effectiveYear));
  }

  if (!paginate) {
    const allPapers = await db
      .select({
        id: papers.id,
        title: papers.title,
        abstract: papers.abstract,
        visibility: papers.visibility,
        venue: papers.venue,
        venueType: papers.venueType,
        year: papers.year,
        category: papers.category,
        tags: papers.tags,
        createdAt: papers.createdAt,
      })
      .from(paperOrgs)
      .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
      .where(and(...finalFilters))
      .orderBy(desc(papers.year), desc(papers.createdAt))
      .all();
    return c.json({ papers: allPapers });
  }

  const [totalRow, papersRows, yearOptions, venueOptions, categoryOptions] =
    await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(and(...finalFilters))
        .get(),
      db
        .select({
          id: papers.id,
          title: papers.title,
          abstract: papers.abstract,
          visibility: papers.visibility,
          venue: papers.venue,
          venueType: papers.venueType,
          year: papers.year,
          category: papers.category,
          tags: papers.tags,
          createdAt: papers.createdAt,
        })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(and(...finalFilters))
        .orderBy(desc(papers.year), desc(papers.createdAt))
        .limit(ORG_PAPERS_PAGE_SIZE)
        .offset((page - 1) * ORG_PAPERS_PAGE_SIZE)
        .all(),
      db
        .select({
          value: papers.year,
          count: sql<number>`COUNT(*)`,
        })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(
          and(
            ...baseFilters,
            venueQuery
              ? sql`${papers.venue} LIKE ${`%${escapeLikeLiteral(venueQuery)}%`} ESCAPE '\\'`
              : undefined,
            categoryFilter ? eq(papers.category, categoryFilter) : undefined,
            isNotNull(papers.year),
          ),
        )
        .groupBy(papers.year)
        .orderBy(desc(papers.year))
        .all(),
      db
        .select({
          value: papers.venue,
          count: sql<number>`COUNT(*)`,
        })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(
          and(
            ...baseFilters,
            effectiveYear !== null ? eq(papers.year, effectiveYear) : undefined,
            categoryFilter ? eq(papers.category, categoryFilter) : undefined,
            isNotNull(papers.venue),
            // Use raw SQL for the trimmed column predicate because Drizzle has no helper for it.
            sql`TRIM(${papers.venue}) != ''`,
          ),
        )
        .groupBy(papers.venue)
        .orderBy(desc(sql<number>`COUNT(*)`), papers.venue)
        .all(),
      db
        .select({
          value: papers.category,
          count: sql<number>`COUNT(*)`,
        })
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(
          and(
            ...baseFilters,
            effectiveYear !== null ? eq(papers.year, effectiveYear) : undefined,
            venueQuery
              ? sql`${papers.venue} LIKE ${`%${escapeLikeLiteral(venueQuery)}%`} ESCAPE '\\'`
              : undefined,
            isNotNull(papers.category),
          ),
        )
        .groupBy(papers.category)
        .orderBy(desc(sql<number>`COUNT(*)`), papers.category)
        .all(),
    ]);

  const total = totalRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ORG_PAPERS_PAGE_SIZE));

  return c.json({
    papers: papersRows,
    total,
    page,
    pageSize: ORG_PAPERS_PAGE_SIZE,
    totalPages,
    appliedFilters: {
      year: effectiveYear,
      venue: venueQuery,
      category: categoryQuery,
    },
    filterOptions: {
      years: yearOptions
        .filter((row) => typeof row.value === "number")
        .map((row) => ({ value: row.value as number, count: row.count })),
      venues: venueOptions
        .filter(
          (row) => typeof row.value === "string" && row.value.trim().length > 0,
        )
        .map((row) => ({ value: row.value as string, count: row.count })),
      categories: categoryOptions
        .filter((row) => typeof row.value === "string" && row.value.length > 0)
        .map((row) => ({ value: row.value as string, count: row.count })),
    },
  });
});

// POST /api/orgs/:slug/papers — associate paper with org
orgsRoute.post("/:slug/papers", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type AddPaperBody = {
    paperId?: unknown;
  };
  const payload = body as AddPaperBody;

  const paperIdResult = normalizeBoundedId(payload.paperId, "paperId");
  if (paperIdResult.error) {
    return c.json({ error: paperIdResult.error }, 400);
  }
  const paperId = paperIdResult.value as string;

  // Check paper exists
  const paper = await db
    .select()
    .from(papers)
    .where(eq(papers.id, paperId))
    .get();
  if (!paper) return c.json({ error: "Paper not found" }, 404);

  // Check permission: must be admin OR paper author
  const isAdmin = await requireOrgAdmin(db, org.id, userId);
  const isAuthor = await isPaperAuthor(db, paperId, userId);

  if (!isAdmin.ok && !isAuthor) {
    return c.json(
      { error: "Forbidden: must be org admin or paper author" },
      403,
    );
  }

  // Check not already associated
  const existing = await db
    .select()
    .from(paperOrgs)
    .where(and(eq(paperOrgs.paperId, paperId), eq(paperOrgs.orgId, org.id)))
    .get();
  if (existing)
    return c.json({ error: "Paper is already associated with this org" }, 409);

  try {
    await db.insert(paperOrgs).values({
      paperId,
      orgId: org.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return c.json(
        { error: "Paper is already associated with this org" },
        409,
      );
    }
    throw err;
  }

  return c.json({ ok: true }, 201);
});

// DELETE /api/orgs/:slug/papers/:paperId — remove paper from org
orgsRoute.delete("/:slug/papers/:paperId", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const paperIdResult = normalizeBoundedId(c.req.param("paperId"), "paperId");
  if (paperIdResult.error) {
    return c.json({ error: paperIdResult.error }, 400);
  }
  const paperId = paperIdResult.value as string;
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  const org = await getOrgBySlug(db, slug);
  if (!org) return c.json({ error: "Org not found" }, 404);

  // Check permission: must be admin OR paper author
  const isAdmin = await requireOrgAdmin(db, org.id, userId);
  const isAuthor = await isPaperAuthor(db, paperId, userId);

  if (!isAdmin.ok && !isAuthor) {
    return c.json(
      { error: "Forbidden: must be org admin or paper author" },
      403,
    );
  }

  const existing = await db
    .select()
    .from(paperOrgs)
    .where(and(eq(paperOrgs.paperId, paperId), eq(paperOrgs.orgId, org.id)))
    .get();
  if (!existing)
    return c.json({ error: "Paper is not associated with this org" }, 404);

  await db
    .delete(paperOrgs)
    .where(and(eq(paperOrgs.paperId, paperId), eq(paperOrgs.orgId, org.id)));

  return c.json({ ok: true });
});

export default orgsRoute;
