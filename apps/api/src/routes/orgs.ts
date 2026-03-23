import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
    orgs,
    orgMembers,
    paperOrgs,
    papers,
    paperAuthors,
    users,
    enableForeignKeys,
    touchUpdatedAt,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
    getOrgBySlug,
    getOrgMembership,
    isOrgMember,
    isPaperAuthor,
    requireOrgAdmin,
} from "../utils/db";
import { validateSlug, validateName, validateDescription } from "../utils/validation";

const orgsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Permission helpers ─────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// 1. Org CRUD
// ═══════════════════════════════════════════════════════════════

orgsRoute.post("/", authMiddleware, async (c) => {
    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const slugErr = validateSlug(body?.slug);
    if (slugErr) return c.json({ error: slugErr }, 400);
    const nameErr = validateName(body?.name);
    if (nameErr) return c.json({ error: nameErr }, 400);
    const descErr = validateDescription(body?.description);
    if (descErr) return c.json({ error: descErr }, 400);

    const slug = (body.slug as string).trim().toLowerCase();
    const name = (body.name as string).trim();
    const description = body.description ? (body.description as string).trim() || null : null;

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

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

        await db.insert(orgMembers).values({
            orgId,
            userId,
            role: "admin",
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("UNIQUE") || message.includes("unique")) {
            return c.json({ error: "slug already in use" }, 409);
        }
        throw err;
    }

    const org = await db.select().from(orgs).where(eq(orgs.id, orgId)).get();
    return c.json({ org }, 201);
});

orgsRoute.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const memberCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(orgMembers)
        .where(eq(orgMembers.orgId, org.id))
        .get();

    return c.json({
        org,
        memberCount: memberCount?.count ?? 0,
    });
});

orgsRoute.patch("/:slug", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const adminCheck = await requireOrgAdmin(db, org.id, userId);
    if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const updates: Record<string, any> = {};

    if (body.name !== undefined) {
        const nameErr = validateName(body.name);
        if (nameErr) return c.json({ error: nameErr }, 400);
        updates.name = (body.name as string).trim();
    }

    if (body.slug !== undefined) {
        const slugErr = validateSlug(body.slug);
        if (slugErr) return c.json({ error: slugErr }, 400);
        const newSlug = (body.slug as string).trim().toLowerCase();
        if (newSlug !== org.slug) {
            const existing = await getOrgBySlug(db, newSlug);
            if (existing) return c.json({ error: "slug already in use" }, 409);
            updates.slug = newSlug;
        }
    }

    if (body.description !== undefined) {
        const descErr = validateDescription(body.description);
        if (descErr) return c.json({ error: descErr }, 400);
        updates.description = body.description ? (body.description as string).trim() : null;
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
    }

    await db.update(orgs).set(updates).where(eq(orgs.id, org.id));
    const updated = await db.select().from(orgs).where(eq(orgs.id, org.id)).get();
    return c.json({ org: updated });
});

orgsRoute.delete("/:slug", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const adminCheck = await requireOrgAdmin(db, org.id, userId);
    if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

    await db.delete(orgs).where(eq(orgs.id, org.id));
    return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// 2. Member management
// ═══════════════════════════════════════════════════════════════

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

orgsRoute.post("/:slug/members", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const adminCheck = await requireOrgAdmin(db, org.id, userId);
    if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const targetUserId = body?.userId;
    if (typeof targetUserId !== "string" || !targetUserId.trim()) {
        return c.json({ error: "userId is required" }, 400);
    }

    const role = body?.role ?? "member";
    if (!["admin", "member"].includes(role)) {
        return c.json({ error: "role must be 'admin' or 'member'" }, 400);
    }

    const targetUser = await db.select().from(users).where(eq(users.id, targetUserId.trim())).get();
    if (!targetUser) return c.json({ error: "User not found" }, 404);

    const existing = await getOrgMembership(db, org.id, targetUserId.trim());
    if (existing) return c.json({ error: "User is already a member" }, 409);

    try {
        await db.insert(orgMembers).values({
            orgId: org.id,
            userId: targetUserId.trim(),
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

orgsRoute.patch("/:slug/members/:userId", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const targetUserId = c.req.param("userId");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const adminCheck = await requireOrgAdmin(db, org.id, userId);
    if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const newRole = body?.role;
    if (!["admin", "member"].includes(newRole)) {
        return c.json({ error: "role must be 'admin' or 'member'" }, 400);
    }

    const membership = await getOrgMembership(db, org.id, targetUserId);
    if (!membership) return c.json({ error: "Member not found" }, 404);

    if (newRole === "member" && (membership.role === "admin" || membership.role === "owner")) {
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
        .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUserId)));

    return c.json({ ok: true });
});

orgsRoute.delete("/:slug/members/:userId", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const targetUserId = c.req.param("userId");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const adminCheck = await requireOrgAdmin(db, org.id, userId);
    if (!adminCheck.ok) return c.json({ error: adminCheck.error }, 403);

    const membership = await getOrgMembership(db, org.id, targetUserId);
    if (!membership) return c.json({ error: "Member not found" }, 404);

    if (membership.role === "admin" || membership.role === "owner") {
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
        .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, targetUserId)));

    return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// 3. Paper ↔ Org association
// ═══════════════════════════════════════════════════════════════

orgsRoute.get("/:slug/papers", async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    let currentUserId: string | null = null;
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        try {
            const { verify } = await import("hono/jwt");
            const payload = await verify(authHeader.slice(7), c.env.JWT_SECRET, "HS256") as any;
            currentUserId = payload.sub ?? null;
        } catch {
            // Not authenticated: show only public papers below.
        }
    }

    const isMember = currentUserId ? await isOrgMember(db, org.id, currentUserId) : false;

    const paperOrgRows = await db
        .select({ paperId: paperOrgs.paperId })
        .from(paperOrgs)
        .where(eq(paperOrgs.orgId, org.id))
        .all();

    if (paperOrgRows.length === 0) return c.json({ papers: [] });

    const paperIds = paperOrgRows.map((r) => r.paperId);

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
        .from(papers)
        .where(inArray(papers.id, paperIds))
        .all();

    let authoredPaperIds = new Set<string>();
    if (currentUserId) {
        const nonPublicPaperIds = allPapers
            .filter((p) => p.visibility !== "public")
            .map((p) => p.id);
        if (nonPublicPaperIds.length > 0) {
            const authorships = await db
                .select({ paperId: paperAuthors.paperId })
                .from(paperAuthors)
                .where(
                    and(
                        eq(paperAuthors.userId, currentUserId),
                        inArray(paperAuthors.paperId, nonPublicPaperIds),
                    ),
                )
                .all();
            authoredPaperIds = new Set(authorships.map((a) => a.paperId));
        }
    }

    const filtered = allPapers.filter((p) => {
        if (p.visibility === "public") return true;
        if (p.visibility === "org_only" && (isMember || authoredPaperIds.has(p.id))) return true;
        if (p.visibility === "private" && authoredPaperIds.has(p.id)) return true;
        return false;
    });

    return c.json({ papers: filtered });
});

orgsRoute.post("/:slug/papers", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const paperId = body?.paperId;
    if (typeof paperId !== "string" || !paperId.trim()) {
        return c.json({ error: "paperId is required" }, 400);
    }

    const paper = await db.select().from(papers).where(eq(papers.id, paperId.trim())).get();
    if (!paper) return c.json({ error: "Paper not found" }, 404);

    const isAdmin = await requireOrgAdmin(db, org.id, userId);
    const isAuthor = await isPaperAuthor(db, paperId.trim(), userId);

    if (!isAdmin.ok && !isAuthor) {
        return c.json({ error: "Forbidden: must be org admin or paper author" }, 403);
    }

    const existing = await db
        .select()
        .from(paperOrgs)
        .where(and(eq(paperOrgs.paperId, paperId.trim()), eq(paperOrgs.orgId, org.id)))
        .get();
    if (existing) return c.json({ error: "Paper is already associated with this org" }, 409);

    try {
        await db.insert(paperOrgs).values({
            paperId: paperId.trim(),
            orgId: org.id,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("UNIQUE") || message.includes("unique")) {
            return c.json({ error: "Paper is already associated with this org" }, 409);
        }
        throw err;
    }

    return c.json({ ok: true }, 201);
});

orgsRoute.delete("/:slug/papers/:paperId", authMiddleware, async (c) => {
    const slug = c.req.param("slug");
    const paperId = c.req.param("paperId");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const org = await getOrgBySlug(db, slug);
    if (!org) return c.json({ error: "Org not found" }, 404);

    const isAdmin = await requireOrgAdmin(db, org.id, userId);
    const isAuthor = await isPaperAuthor(db, paperId, userId);

    if (!isAdmin.ok && !isAuthor) {
        return c.json({ error: "Forbidden: must be org admin or paper author" }, 403);
    }

    const existing = await db
        .select()
        .from(paperOrgs)
        .where(and(eq(paperOrgs.paperId, paperId), eq(paperOrgs.orgId, org.id)))
        .get();
    if (!existing) return c.json({ error: "Paper is not associated with this org" }, 404);

    await db
        .delete(paperOrgs)
        .where(and(eq(paperOrgs.paperId, paperId), eq(paperOrgs.orgId, org.id)));

    return c.json({ ok: true });
});

export default orgsRoute;
