import { Hono } from "hono";
import { verify } from "hono/jwt";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  collectionPapers,
  collections,
  enableForeignKeys,
  orgMembers,
  orgs,
  paperAuthors,
  paperOrgs,
  papers,
  touchUpdatedAt,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";
import { ID_MAX_LENGTH } from "../utils/constants";
import { isUniqueConstraintError } from "../utils/db";

const collectionsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const VALID_VISIBILITY = ["public", "org_only", "private"] as const;

type Visibility = (typeof VALID_VISIBILITY)[number];
type CurrentUser = { id: string } | null;

function validateSlug(slug: unknown): string | null {
  if (typeof slug !== "string") return "slug is required";
  const s = slug.trim().toLowerCase();
  if (s.length < 3 || s.length > 40) return "slug must be 3-40 characters";
  if (!SLUG_RE.test(s))
    return "slug must contain only lowercase letters, numbers, and hyphens";
  if (s.includes("--")) return "slug must not contain consecutive hyphens";
  return null;
}

export function validateName(name: unknown): string | null {
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

function normalizePaperId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > ID_MAX_LENGTH) return null;
  return id;
}

function parseVisibility(value: unknown): Visibility | null {
  if (
    typeof value === "string" &&
    VALID_VISIBILITY.includes(value as Visibility)
  ) {
    return value as Visibility;
  }
  return null;
}

async function getCurrentUser(c: any): Promise<CurrentUser> {
  const middlewareUser = c.get("user") as { sub?: string } | undefined;
  if (middlewareUser?.sub) return { id: middlewareUser.sub };

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as {
      sub?: string;
    };
    if (!payload?.sub) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

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

async function isOrgMember(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  userId: string,
) {
  return !!(await getOrgMembership(db, orgId, userId));
}

async function isOrgAdmin(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  userId: string,
) {
  const row = await getOrgMembership(db, orgId, userId);
  return !!row && (row.role === "admin" || row.role === "owner");
}

async function isPaperAuthor(
  db: ReturnType<typeof drizzle>,
  paperId: string,
  userId: string,
) {
  const author = await db
    .select()
    .from(paperAuthors)
    .where(
      and(eq(paperAuthors.paperId, paperId), eq(paperAuthors.userId, userId)),
    )
    .get();
  return !!author;
}

async function isMemberOfPaperOrg(
  db: ReturnType<typeof drizzle>,
  paperId: string,
  userId: string,
) {
  const isMember = await db
    .select({ id: orgMembers.userId })
    .from(orgMembers)
    .innerJoin(paperOrgs, eq(orgMembers.orgId, paperOrgs.orgId))
    .where(and(eq(paperOrgs.paperId, paperId), eq(orgMembers.userId, userId)))
    .get();
  return !!isMember;
}

async function canViewCollection(
  db: ReturnType<typeof drizzle>,
  collection: typeof collections.$inferSelect,
  currentUser: CurrentUser,
): Promise<boolean> {
  if (collection.visibility === "public") return true;
  if (!currentUser) return false;

  if (collection.ownerType === "user") {
    return collection.ownerId === currentUser.id;
  }

  if (collection.visibility === "private") {
    return isOrgAdmin(db, collection.ownerId, currentUser.id);
  }

  return isOrgMember(db, collection.ownerId, currentUser.id);
}

async function canManageCollection(
  db: ReturnType<typeof drizzle>,
  collection: typeof collections.$inferSelect,
  userId: string,
): Promise<boolean> {
  if (collection.ownerType === "user") {
    return collection.ownerId === userId;
  }
  return isOrgAdmin(db, collection.ownerId, userId);
}

async function canViewPaper(
  db: ReturnType<typeof drizzle>,
  paper: { id: string; visibility: string },
  userId: string | null,
): Promise<boolean> {
  if (paper.visibility === "public") return true;
  if (!userId) return false;

  if (await isPaperAuthor(db, paper.id, userId)) return true;
  if (paper.visibility === "private") return false;

  return await isMemberOfPaperOrg(db, paper.id, userId);
}

collectionsRoute.post("/collections", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type CreateCollectionBody = {
    owner_type?: unknown;
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    visibility?: unknown;
    org_slug?: unknown;
    owner_id?: unknown;
  };
  const payload = body as CreateCollectionBody;

  const ownerType = payload.owner_type;
  if (ownerType !== "user" && ownerType !== "org") {
    return c.json({ error: "owner_type must be 'user' or 'org'" }, 400);
  }

  const nameErr = validateName(payload.name);
  if (nameErr) return c.json({ error: nameErr }, 400);

  const slugErr = validateSlug(payload.slug);
  if (slugErr) return c.json({ error: slugErr }, 400);

  const descErr = validateDescription(payload.description);
  if (descErr) return c.json({ error: descErr }, 400);

  const requesterId = c.get("user").sub;
  const visibility =
    payload.visibility === undefined
      ? "private"
      : parseVisibility(payload.visibility);
  if (!visibility) {
    return c.json({ error: "Invalid visibility" }, 400);
  }

  let ownerId = requesterId;
  let ownerOrgSlug: string | null = null;
  if (ownerType === "org") {
    const inputOrgSlug =
      typeof payload.org_slug === "string"
        ? payload.org_slug.trim().toLowerCase()
        : "";
    const inputOwnerId =
      typeof payload.owner_id === "string" ? payload.owner_id.trim() : "";

    let org = null;
    if (inputOrgSlug) {
      org = await getOrgBySlug(db, inputOrgSlug);
    } else if (inputOwnerId) {
      org = await db.select().from(orgs).where(eq(orgs.id, inputOwnerId)).get();
    }

    if (!org) return c.json({ error: "Org not found" }, 404);

    const admin = await isOrgAdmin(db, org.id, requesterId);
    if (!admin)
      return c.json({ error: "Forbidden: admin access required" }, 403);

    ownerId = org.id;
    ownerOrgSlug = org.slug;
  }

  const id = crypto.randomUUID();
  const slug = (payload.slug as string).trim().toLowerCase();

  try {
    await db.insert(collections).values({
      id,
      ownerType,
      ownerId,
      orgSlug: ownerOrgSlug,
      name: (payload.name as string).trim(),
      slug,
      description: payload.description
        ? (payload.description as string).trim()
        : null,
      visibility,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return c.json({ error: "slug already in use" }, 409);
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .get();
  return c.json({ collection }, 201);
});

collectionsRoute.get("/collections/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const currentUser = await getCurrentUser(c);

  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, c.req.param("id")))
    .get();
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const visible = await canViewCollection(db, collection, currentUser);
  if (!visible) return c.json({ error: "Collection not found" }, 404);

  return c.json({ collection });
});

collectionsRoute.patch("/collections/:id", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);

  const id = c.req.param("id");
  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .get();
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const requesterId = c.get("user").sub;
  if (!(await canManageCollection(db, collection, requesterId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type UpdateCollectionBody = {
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    visibility?: unknown;
  };
  const payload = body as UpdateCollectionBody;

  const updates: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    const e = validateName(payload.name);
    if (e) return c.json({ error: e }, 400);
    updates.name = (payload.name as string).trim();
  }

  if (payload.slug !== undefined) {
    const e = validateSlug(payload.slug);
    if (e) return c.json({ error: e }, 400);
    updates.slug = (payload.slug as string).trim().toLowerCase();
  }

  if (payload.description !== undefined) {
    const e = validateDescription(payload.description);
    if (e) return c.json({ error: e }, 400);
    updates.description = payload.description
      ? (payload.description as string).trim()
      : null;
  }

  if (payload.visibility !== undefined) {
    const visibility = parseVisibility(payload.visibility);
    if (!visibility) {
      return c.json({ error: "Invalid visibility" }, 400);
    }
    updates.visibility = visibility;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  try {
    await db
      .update(collections)
      .set({ ...updates, ...touchUpdatedAt() })
      .where(eq(collections.id, id));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return c.json({ error: "slug already in use" }, 409);
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  const updated = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .get();
  return c.json({ collection: updated });
});

collectionsRoute.delete("/collections/:id", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);

  const id = c.req.param("id");
  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .get();
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const requesterId = c.get("user").sub;
  if (!(await canManageCollection(db, collection, requesterId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.delete(collections).where(eq(collections.id, id));
  return c.json({ ok: true });
});

collectionsRoute.get("/orgs/:slug/collections", async (c) => {
  const db = drizzle(c.env.DB);
  const currentUser = await getCurrentUser(c);
  const org = await getOrgBySlug(db, c.req.param("slug"));
  if (!org) return c.json({ collections: [] });

  const rows = await db
    .select()
    .from(collections)
    .where(
      and(eq(collections.ownerType, "org"), eq(collections.ownerId, org.id)),
    )
    .all();

  // Pre-fetch membership once to avoid N+1 queries across collection rows
  let currentUserIsMember = false;
  let currentUserIsAdmin = false;
  if (currentUser) {
    const membership = await getOrgMembership(db, org.id, currentUser.id);
    currentUserIsMember = !!membership;
    currentUserIsAdmin =
      !!membership &&
      (membership.role === "admin" || membership.role === "owner");
  }

  const filtered = rows.filter((row) => {
    if (row.visibility === "public") return true;
    if (!currentUser) return false;
    if (row.visibility === "private") return currentUserIsAdmin;
    return currentUserIsMember;
  });

  return c.json({ collections: filtered });
});

collectionsRoute.get("/users/:id/collections", async (c) => {
  const db = drizzle(c.env.DB);
  const currentUser = await getCurrentUser(c);

  const rows = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.ownerType, "user"),
        eq(collections.ownerId, c.req.param("id")),
      ),
    )
    .all();

  const filtered = rows.filter((row) => {
    if (row.visibility === "public") return true;
    return !!currentUser && currentUser.id === row.ownerId;
  });

  return c.json({ collections: filtered });
});

collectionsRoute.post("/collections/:id/papers", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);

  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, c.req.param("id")))
    .get();
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const requesterId = c.get("user").sub;
  if (!(await canManageCollection(db, collection, requesterId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type AddPaperToCollectionBody = {
    paper_id?: unknown;
  };
  const payload = body as AddPaperToCollectionBody;

  const paperId = normalizePaperId(payload.paper_id);
  if (!paperId)
    return c.json({ error: "paper_id is invalid or too long" }, 400);

  const paper = await db
    .select()
    .from(papers)
    .where(eq(papers.id, paperId))
    .get();
  if (!paper) return c.json({ error: "Paper not found" }, 404);

  // Only allow adding papers the collection manager can actually view
  const canView = await canViewPaper(db, paper, requesterId);
  if (!canView) return c.json({ error: "Paper not found" }, 404);

  const maxOrderRow = await db
    .select({
      maxOrder: sql<number>`COALESCE(MAX(${collectionPapers.sortOrder}), -1)`,
    })
    .from(collectionPapers)
    .where(eq(collectionPapers.collectionId, collection.id))
    .get();

  try {
    await db.insert(collectionPapers).values({
      collectionId: collection.id,
      paperId,
      sortOrder: (maxOrderRow?.maxOrder ?? -1) + 1,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return c.json({ error: "Paper already added" }, 409);
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
  return c.json({ ok: true }, 201);
});

collectionsRoute.delete(
  "/collections/:id/papers/:paperId",
  authMiddleware,
  async (c) => {
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const collection = await db
      .select()
      .from(collections)
      .where(eq(collections.id, c.req.param("id")))
      .get();
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const requesterId = c.get("user").sub;
    if (!(await canManageCollection(db, collection, requesterId))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const paperId = normalizePaperId(c.req.param("paperId"));
    if (!paperId) {
      return c.json({ error: "paper_id is invalid or too long" }, 400);
    }

    const result = await db
      .delete(collectionPapers)
      .where(
        and(
          eq(collectionPapers.collectionId, collection.id),
          eq(collectionPapers.paperId, paperId),
        ),
      );

    if ((result as any).meta?.changes === 0) {
      return c.json({ error: "Paper not in collection" }, 404);
    }
    return c.json({ ok: true });
  },
);

collectionsRoute.patch("/collections/:id/papers", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);

  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, c.req.param("id")))
    .get();
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const requesterId = c.get("user").sub;
  if (!(await canManageCollection(db, collection, requesterId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  type BatchAddPapersToCollectionBody = {
    paper_ids?: unknown;
  };
  const payload = body as BatchAddPapersToCollectionBody;

  const paperIds = Array.isArray(payload.paper_ids)
    ? payload.paper_ids.map(normalizePaperId)
    : [];
  if (paperIds.length === 0)
    return c.json({ error: "paper_ids is required" }, 400);
  if (paperIds.some((id) => !id)) {
    return c.json(
      { error: "paper_ids must be an array of valid strings" },
      400,
    );
  }
  const normalizedPaperIds = paperIds as string[];

  const existingRows = await db
    .select({ paperId: collectionPapers.paperId })
    .from(collectionPapers)
    .where(eq(collectionPapers.collectionId, collection.id))
    .all();

  const existingSet = new Set(existingRows.map((r) => r.paperId));
  const uniqueInput = new Set(normalizedPaperIds);
  if (uniqueInput.size !== normalizedPaperIds.length) {
    return c.json({ error: "paper_ids must not contain duplicates" }, 400);
  }
  if (normalizedPaperIds.length !== existingRows.length) {
    return c.json(
      { error: "paper_ids must include all papers in collection" },
      400,
    );
  }
  if (normalizedPaperIds.some((id) => !existingSet.has(id))) {
    return c.json({ error: "paper_ids contains paper not in collection" }, 400);
  }

  // Atomically apply all sort order changes via D1 batch
  const updateStatements = normalizedPaperIds.map((pid, i) =>
    db
      .update(collectionPapers)
      .set({ sortOrder: i })
      .where(
        and(
          eq(collectionPapers.collectionId, collection.id),
          eq(collectionPapers.paperId, pid),
        ),
      ),
  );
  await db.batch(
    updateStatements as [
      (typeof updateStatements)[0],
      ...typeof updateStatements,
    ],
  );
  return c.json({ ok: true });
});

collectionsRoute.get("/collections/:id/papers", async (c) => {
  const db = drizzle(c.env.DB);
  const currentUser = await getCurrentUser(c);

  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.id, c.req.param("id")))
    .get();
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const visible = await canViewCollection(db, collection, currentUser);
  if (!visible) return c.json({ error: "Collection not found" }, 404);

  const rows = await db
    .select({
      id: papers.id,
      title: papers.title,
      abstract: papers.abstract,
      visibility: papers.visibility,
      year: papers.year,
      venue: papers.venue,
      category: papers.category,
      sortOrder: collectionPapers.sortOrder,
    })
    .from(collectionPapers)
    .innerJoin(papers, eq(collectionPapers.paperId, papers.id))
    .where(eq(collectionPapers.collectionId, collection.id))
    .orderBy(asc(collectionPapers.sortOrder))
    .all();

  const currentUserId = currentUser?.id ?? null;
  let visiblePapers: typeof rows;

  const restrictedRows = rows.filter((r) => r.visibility !== "public");
  if (restrictedRows.length === 0) {
    // All papers are public – no authz queries needed
    visiblePapers = rows;
  } else if (!currentUserId) {
    visiblePapers = rows.filter((r) => r.visibility === "public");
  } else {
    const restrictedIds = restrictedRows.map((r) => r.id);

    // Batch 1: which restricted papers is this user an author of?
    const authoredRows = await db
      .select({ paperId: paperAuthors.paperId })
      .from(paperAuthors)
      .where(
        and(
          inArray(paperAuthors.paperId, restrictedIds),
          eq(paperAuthors.userId, currentUserId),
        ),
      )
      .all();
    const authoredSet = new Set(authoredRows.map((r) => r.paperId));

    // Batch 2: which org_only papers can the user see via org membership?
    const orgOnlyIds = restrictedRows
      .filter((r) => r.visibility === "org_only" && !authoredSet.has(r.id))
      .map((r) => r.id);
    const orgAccessSet = new Set<string>();
    if (orgOnlyIds.length > 0) {
      const orgAccessRows = await db
        .select({ paperId: paperOrgs.paperId })
        .from(orgMembers)
        .innerJoin(paperOrgs, eq(orgMembers.orgId, paperOrgs.orgId))
        .where(
          and(
            inArray(paperOrgs.paperId, orgOnlyIds),
            eq(orgMembers.userId, currentUserId),
          ),
        )
        .all();
      for (const r of orgAccessRows) orgAccessSet.add(r.paperId);
    }

    visiblePapers = rows.filter((r) => {
      if (r.visibility === "public") return true;
      if (authoredSet.has(r.id)) return true;
      if (r.visibility === "org_only" && orgAccessSet.has(r.id)) return true;
      return false;
    });
  }

  return c.json({ papers: visiblePapers });
});

export default collectionsRoute;
