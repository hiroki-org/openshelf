import { Hono } from "hono";
import { verify } from "hono/jwt";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
    collectionPapers,
    collections,
    enableForeignKeys,
    orgMembers,
    orgs,
    papers,
    touchUpdatedAt,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

const collectionsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const VALID_VISIBILITY = ["public", "org_only", "private"] as const;

type Visibility = (typeof VALID_VISIBILITY)[number];
type CurrentUser = { id: string } | null;

function validateSlug(slug: unknown): string | null {
    if (typeof slug !== "string") return "slug is required";
    const s = slug.trim().toLowerCase();
    if (s.length < 3 || s.length > 40) return "slug must be 3-40 characters";
    if (!SLUG_RE.test(s)) return "slug must contain only lowercase letters, numbers, and hyphens";
    if (s.includes("--")) return "slug must not contain consecutive hyphens";
    return null;
}

function validateName(name: unknown): string | null {
    if (typeof name !== "string" || name.trim().length === 0) return "name is required";
    if (name.trim().length > 100) return "name must be 100 characters or less";
    return null;
}

function validateDescription(description: unknown): string | null {
    if (description === undefined || description === null || description === "") return null;
    if (typeof description !== "string") return "description must be a string";
    if (description.trim().length > 500) return "description must be 500 characters or less";
    return null;
}

function parseVisibility(value: unknown): Visibility {
    if (typeof value === "string" && VALID_VISIBILITY.includes(value as Visibility)) {
        return value as Visibility;
    }
    return "public";
}

function isUniqueConstraintError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes("UNIQUE") || message.includes("unique") || message.includes("constraint");
}

async function getCurrentUser(c: any): Promise<CurrentUser> {
    const middlewareUser = c.get("user") as { sub?: string } | undefined;
    if (middlewareUser?.sub) return { id: middlewareUser.sub };

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return null;

    try {
        const payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as { sub?: string };
        if (!payload?.sub) return null;
        return { id: payload.sub };
    } catch {
        return null;
    }
}

async function getOrgBySlug(db: ReturnType<typeof drizzle>, slug: string) {
    return db.select().from(orgs).where(eq(orgs.slug, slug)).get();
}

async function getOrgMembership(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    return db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .get();
}

async function isOrgMember(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    return !!(await getOrgMembership(db, orgId, userId));
}

async function isOrgAdmin(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    const row = await getOrgMembership(db, orgId, userId);
    return !!row && (row.role === "admin" || row.role === "owner");
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

collectionsRoute.post("/collections", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const ownerType = body?.owner_type;
    if (ownerType !== "user" && ownerType !== "org") {
        return c.json({ error: "owner_type must be 'user' or 'org'" }, 400);
    }

    const nameErr = validateName(body?.name);
    if (nameErr) return c.json({ error: nameErr }, 400);

    const slugErr = validateSlug(body?.slug);
    if (slugErr) return c.json({ error: slugErr }, 400);

    const descErr = validateDescription(body?.description);
    if (descErr) return c.json({ error: descErr }, 400);

    const requesterId = c.get("user").sub;
    const visibility = parseVisibility(body?.visibility);

    let ownerId = requesterId;
    if (ownerType === "org") {
        const inputOrgSlug = typeof body?.org_slug === "string" ? body.org_slug.trim().toLowerCase() : "";
        const inputOwnerId = typeof body?.owner_id === "string" ? body.owner_id.trim() : "";

        let org = null;
        if (inputOrgSlug) {
            org = await getOrgBySlug(db, inputOrgSlug);
        } else if (inputOwnerId) {
            org = await db.select().from(orgs).where(eq(orgs.id, inputOwnerId)).get();
        }

        if (!org) return c.json({ error: "Org not found" }, 404);

        const admin = await isOrgAdmin(db, org.id, requesterId);
        if (!admin) return c.json({ error: "Forbidden: admin access required" }, 403);

        ownerId = org.id;
    }

    const id = crypto.randomUUID();
    const slug = (body.slug as string).trim().toLowerCase();

    try {
        await db.insert(collections).values({
            id,
            ownerType,
            ownerId, name: (body.name as string).trim(),
            slug,
            description: body?.description ? (body.description as string).trim() : null,
            visibility,
        });
    } catch (err) {
        if (isUniqueConstraintError(err)) {
            return c.json({ error: "slug already in use" }, 409);
        }
        throw err;
    }

    const collection = await db.select().from(collections).where(eq(collections.id, id)).get();
    return c.json({ collection }, 201);
});

collectionsRoute.get("/collections/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const currentUser = await getCurrentUser(c);

    const collection = await db.select().from(collections).where(eq(collections.id, c.req.param("id"))).get();
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const visible = await canViewCollection(db, collection, currentUser);
    if (!visible) return c.json({ error: "Collection not found" }, 404);

    return c.json({ collection });
});

collectionsRoute.patch("/collections/:id", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const id = c.req.param("id");
    const collection = await db.select().from(collections).where(eq(collections.id, id)).get();
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const requesterId = c.get("user").sub;
    if (!(await canManageCollection(db, collection, requesterId))) {
        return c.json({ error: "Forbidden" }, 403);
    }

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const updates: Record<string, unknown> = {};

    if (body?.name !== undefined) {
        const e = validateName(body.name);
        if (e) return c.json({ error: e }, 400);
        updates.name = (body.name as string).trim();
    }

    if (body?.slug !== undefined) {
        const e = validateSlug(body.slug);
        if (e) return c.json({ error: e }, 400);
        updates.slug = (body.slug as string).trim().toLowerCase();
    }

    if (body?.description !== undefined) {
        const e = validateDescription(body.description);
        if (e) return c.json({ error: e }, 400);
        updates.description = body.description ? (body.description as string).trim() : null;
    }

    if (body?.visibility !== undefined) {
        if (!VALID_VISIBILITY.includes(body.visibility)) {
            return c.json({ error: "Invalid visibility" }, 400);
        }
        updates.visibility = body.visibility;
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
        throw err;
    }

    const updated = await db.select().from(collections).where(eq(collections.id, id)).get();
    return c.json({ collection: updated });
});

collectionsRoute.delete("/collections/:id", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const id = c.req.param("id");
    const collection = await db.select().from(collections).where(eq(collections.id, id)).get();
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
        .where(and(eq(collections.ownerType, "org"), eq(collections.ownerId, org.id)))
        .all();

    const filtered: typeof rows = [];
    for (const row of rows) {
        if (await canViewCollection(db, row, currentUser)) filtered.push(row);
    }

    return c.json({ collections: filtered });
});

collectionsRoute.get("/users/:id/collections", async (c) => {
    const db = drizzle(c.env.DB);
    const currentUser = await getCurrentUser(c);

    const rows = await db
        .select()
        .from(collections)
        .where(and(eq(collections.ownerType, "user"), eq(collections.ownerId, c.req.param("id"))))
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

    const collection = await db.select().from(collections).where(eq(collections.id, c.req.param("id"))).get();
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const requesterId = c.get("user").sub;
    if (!(await canManageCollection(db, collection, requesterId))) {
        return c.json({ error: "Forbidden" }, 403);
    }

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const paperId = typeof body?.paper_id === "string" ? body.paper_id.trim() : "";
    if (!paperId) return c.json({ error: "paper_id is required" }, 400);

    const paper = await db.select().from(papers).where(eq(papers.id, paperId)).get();
    if (!paper) return c.json({ error: "Paper not found" }, 404);

    const maxOrderRow = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${collectionPapers.sortOrder}), -1)` })
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
        throw err;
    } return c.json({ ok: true }, 201);
});

collectionsRoute.delete("/collections/:id/papers/:paperId", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const collection = await db.select().from(collections).where(eq(collections.id, c.req.param("id"))).get();
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const requesterId = c.get("user").sub;
    if (!(await canManageCollection(db, collection, requesterId))) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const result = await db
        .delete(collectionPapers)
        .where(and(eq(collectionPapers.collectionId, collection.id), eq(collectionPapers.paperId, c.req.param("paperId"))));

    if ((result as any).meta?.changes === 0) {
        return c.json({ error: "Paper not in collection" }, 404);
    } return c.json({ ok: true });
});

collectionsRoute.patch("/collections/:id/papers", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const collection = await db.select().from(collections).where(eq(collections.id, c.req.param("id"))).get();
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    const requesterId = c.get("user").sub;
    if (!(await canManageCollection(db, collection, requesterId))) {
        return c.json({ error: "Forbidden" }, 403);
    }

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const paperIds = Array.isArray(body?.paper_ids)
        ? body.paper_ids.filter((v: unknown) => typeof v === "string")
        : [];
    if (paperIds.length === 0) return c.json({ error: "paper_ids is required" }, 400);

    const existingRows = await db
        .select({ paperId: collectionPapers.paperId })
        .from(collectionPapers)
        .where(eq(collectionPapers.collectionId, collection.id))
        .all();

    const existingSet = new Set(existingRows.map((r) => r.paperId));
    if (paperIds.some((id: string) => !existingSet.has(id))) {
        return c.json({ error: "paper_ids contains paper not in collection" }, 400);
    }

    for (let i = 0; i < paperIds.length; i++) {
        await db
            .update(collectionPapers)
            .set({ sortOrder: i })
            .where(and(eq(collectionPapers.collectionId, collection.id), eq(collectionPapers.paperId, paperIds[i])));
    } return c.json({ ok: true });
});

collectionsRoute.get("/collections/:id/papers", async (c) => {
    const db = drizzle(c.env.DB);
    const currentUser = await getCurrentUser(c);

    const collection = await db.select().from(collections).where(eq(collections.id, c.req.param("id"))).get();
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

    return c.json({ papers: rows });
});

export default collectionsRoute;
