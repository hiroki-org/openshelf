import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray } from "drizzle-orm";
import {
    papers,
    paperFiles,
    paperAuthors,
    users,
    coauthorInvites,
    orgMembers,
    paperOrgs,
    enableForeignKeys,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { parseAndValidateMetadata, parseAndValidateFiles, insertPaperAndFiles } from "../services/papers";

const papersRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

type AuthResult =
    | { ok: true; user?: { sub: string } }
    | { ok: false; status: ContentfulStatusCode; error: string };

async function authorizePaperAccess(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    db: ReturnType<typeof drizzle>,
    paper: { visibility: string; id: string },
): Promise<AuthResult> {
    if (paper.visibility === "public") return { ok: true };

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
        return { ok: false, status: 401, error: "Unauthorized" };
    }

    const { verify } = await import("hono/jwt");
    let user: { sub: string };
    try {
        user = (await verify(token, c.env.JWT_SECRET, "HS256")) as { sub: string };
    } catch {
        return { ok: false, status: 401, error: "Invalid token" };
    }

    // Authors always have access
    const isAuthor = await db
        .select()
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paper.id),
                eq(paperAuthors.userId, user.sub),
            ),
        )
        .get();
    if (isAuthor) return { ok: true, user };

    if (paper.visibility === "private") {
        return { ok: false, status: 403, error: "Forbidden" };
    }

    if (paper.visibility === "org_only") {
        const isMemberOfPaperOrg = await db
            .select({ id: orgMembers.userId })
            .from(orgMembers)
            .innerJoin(paperOrgs, eq(orgMembers.orgId, paperOrgs.orgId))
            .where(
                and(
                    eq(paperOrgs.paperId, paper.id),
                    eq(orgMembers.userId, user.sub),
                ),
            )
            .get();

        if (!isMemberOfPaperOrg) {
            return { ok: false, status: 403, error: "Forbidden" };
        }
    } else if (paper.visibility !== "public") {
        return { ok: false, status: 403, error: "Forbidden" };
    }

    return { ok: true, user };
}

async function generateSignedPreviewUrl(
    bucket: Env["BUCKET"],
    objectKey: string,
): Promise<string | null> {
    const bucketLike = bucket as unknown as {
        createSignedUrl?: (key: string, options?: { expiresIn?: number }) => Promise<string>;
        presign?: (key: string, options?: { expiresIn?: number }) => Promise<string>;
    };

    try {
        if (typeof bucketLike.createSignedUrl === "function") {
            return await bucketLike.createSignedUrl(objectKey, { expiresIn: 300 });
        }

        if (typeof bucketLike.presign === "function") {
            return await bucketLike.presign(objectKey, { expiresIn: 300 });
        }
    } catch {
        return null;
    }

    return null;
}

// POST /api/papers — create paper + upload files
papersRoute.post("/", authMiddleware, async (c) => {
    const body = await c.req.parseBody({ all: true });

    const metaRes = parseAndValidateMetadata(body["metadata"]);
    if (!metaRes.ok) {
        return c.json({ error: metaRes.error }, metaRes.status as any);
    }
    const metaData = metaRes.data!;

    const vis = metaData.visibility;
    const orgId = metaData.orgId;
    const userId = c.get("user").sub;
    const paperId = crypto.randomUUID();

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    if (vis === "org_only" && orgId) {
        const membership = await db
            .select({ orgId: orgMembers.orgId })
            .from(orgMembers)
            .where(
                and(
                    eq(orgMembers.orgId, orgId),
                    eq(orgMembers.userId, userId),
                ),
            )
            .get();
        if (!membership) {
            console.error(`Membership check failed for userId: ${userId}, orgId: ${orgId}`);
            return c.json({ error: "Invalid orgId or not a member" }, 403);
        }
    }

    const fileRes = await parseAndValidateFiles(body, paperId);
    if (!fileRes.ok) {
        return c.json({ error: fileRes.error }, fileRes.status as any);
    }
    const uploads = fileRes.uploads!;

    const insertRes = await insertPaperAndFiles(c, db, paperId, userId, metaData, uploads);
    if (!insertRes.ok) {
        return c.json({ error: insertRes.error }, insertRes.status as any);
    }

    return c.json({ paper: { id: paperId } }, 201);
});

// GET /api/papers — my papers list
papersRoute.get("/", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("user").sub;

    const rows = await db
        .select({ paper: papers })
        .from(papers)
        .innerJoin(
            paperAuthors,
            and(
                eq(paperAuthors.paperId, papers.id),
                eq(paperAuthors.userId, userId),
            ),
        )
        .all();

    return c.json({ papers: rows.map((r) => r.paper) });
});

// GET /api/papers/:id — paper detail
papersRoute.get("/:id", async (c) => {
    const paperId = c.req.param("id");
    const db = drizzle(c.env.DB);

    const paper = await db
        .select()
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const access = await authorizePaperAccess(c, db, paper);
    if (!access.ok) {
        return c.json({ error: access.error }, access.status);
    }

    const [rawFiles, authors] = (await db.batch([
        db
            .select()
            .from(paperFiles)
            .where(eq(paperFiles.paperId, paperId)),
        db
            .select({
                userId: paperAuthors.userId,
                role: paperAuthors.role,
                name: users.name,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
            })
            .from(paperAuthors)
            .innerJoin(users, eq(paperAuthors.userId, users.id))
            .where(eq(paperAuthors.paperId, paperId)),
    ])) as [
            (typeof paperFiles.$inferSelect)[],
            { userId: string; role: string; name: string | null; displayName: string | null; avatarUrl: string | null }[]
        ];

    const files = rawFiles.map((file) => ({
        ...file,
        downloadUrl: `/api/papers/${paperId}/files/${file.id}/download`,
    }));

    return c.json({
        paper: {
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            visibility: paper.visibility,
            externalUrl: paper.externalUrl,
            venue: paper.venue,
            venueType: paper.venueType,
            year: paper.year,
            category: paper.category,
            tags: paper.tags,
            createdAt: paper.createdAt,
            updatedAt: paper.updatedAt,
        },
        files,
        authors,
    });
});

// GET /api/papers/:id/files/:fileId/download — download file
papersRoute.get("/:id/files/:fileId/download", async (c) => {
    const paperId = c.req.param("id");
    const fileId = c.req.param("fileId");
    const db = drizzle(c.env.DB);

    const paper = await db
        .select()
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const access = await authorizePaperAccess(c, db, paper);
    if (!access.ok) {
        return c.json({ error: access.error }, access.status);
    }

    const file = await db
        .select()
        .from(paperFiles)
        .where(and(eq(paperFiles.id, fileId), eq(paperFiles.paperId, paperId)))
        .get();
    if (!file) return c.json({ error: "File not found" }, 404);

    const object = await c.env.BUCKET.get(file.r2Key);
    if (!object) return c.json({ error: "File not found in storage" }, 404);

    const headers: Record<string, string> = {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
    };
    if (paper.visibility === "public") {
        headers["Cache-Control"] = "public, max-age=3600";
    } else {
        headers["Cache-Control"] = "private, no-store";
        headers["Pragma"] = "no-cache";
        headers["Vary"] = "Authorization";
    }
    if (object.size) {
        headers["Content-Length"] = object.size.toString();
    }

    return new Response(object.body as ReadableStream, { headers });
});

// GET /api/papers/:id/files/:fileId/preview — preview URL metadata for inline rendering
papersRoute.get("/:id/files/:fileId/preview", async (c) => {
    const paperId = c.req.param("id");
    const fileId = c.req.param("fileId");
    const db = drizzle(c.env.DB);

    const paper = await db
        .select()
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const access = await authorizePaperAccess(c, db, paper);
    if (!access.ok) {
        return c.json({ error: access.error }, access.status);
    }

    const file = await db
        .select()
        .from(paperFiles)
        .where(and(eq(paperFiles.id, fileId), eq(paperFiles.paperId, paperId)))
        .get();
    if (!file) return c.json({ error: "File not found" }, 404);

    const signedUrl = await generateSignedPreviewUrl(c.env.BUCKET, file.r2Key);
    const streamUrl = `/api/papers/${paperId}/files/${fileId}/stream`;

    return c.json({
        url: signedUrl ?? streamUrl,
        mimeType: file.mimeType || "application/octet-stream",
        filename: file.filename,
    });
});

// GET /api/papers/:id/files/:fileId/stream — inline object stream fallback for preview
papersRoute.get("/:id/files/:fileId/stream", async (c) => {
    const paperId = c.req.param("id");
    const fileId = c.req.param("fileId");
    const db = drizzle(c.env.DB);

    const paper = await db
        .select()
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const access = await authorizePaperAccess(c, db, paper);
    if (!access.ok) {
        return c.json({ error: access.error }, access.status);
    }

    const file = await db
        .select()
        .from(paperFiles)
        .where(and(eq(paperFiles.id, fileId), eq(paperFiles.paperId, paperId)))
        .get();
    if (!file) return c.json({ error: "File not found" }, 404);

    const object = await c.env.BUCKET.get(file.r2Key);
    if (!object) return c.json({ error: "File not found in storage" }, 404);

    const headers: Record<string, string> = {
        "Content-Type": object.httpMetadata?.contentType || file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
    };

    if (paper.visibility === "public") {
        headers["Cache-Control"] = "public, max-age=300";
    } else {
        headers["Cache-Control"] = "private, no-store";
        headers["Pragma"] = "no-cache";
        headers["Vary"] = "Authorization";
    }

    if (object.size) {
        headers["Content-Length"] = object.size.toString();
    }

    return new Response(object.body as ReadableStream, { headers });
});

// POST /api/papers/:id/invites — send coauthor invite
papersRoute.post("/:id/invites", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    let body: { inviteeId?: unknown; inviteeEmail?: unknown };
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const inviteeId =
        typeof body.inviteeId === "string" && body.inviteeId.trim().length > 0
            ? body.inviteeId.trim()
            : null;
    const inviteeEmail =
        typeof body.inviteeEmail === "string" &&
            body.inviteeEmail.trim().length > 0
            ? body.inviteeEmail.trim().toLowerCase()
            : null;

    if (!inviteeId && !inviteeEmail) {
        return c.json({ error: "inviteeId or inviteeEmail is required" }, 400);
    }

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const isUploader = await db
        .select()
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, userId),
                eq(paperAuthors.role, "uploader"),
            ),
        )
        .get();
    if (!isUploader)
        return c.json({ error: "Only uploaders can invite" }, 403);

    if (inviteeId === userId) {
        return c.json({ error: "Cannot invite yourself" }, 400);
    }

    let resolvedInviteeId: string | null = inviteeId;
    let resolvedInviteeEmail: string | null = inviteeEmail;

    if (!resolvedInviteeId && resolvedInviteeEmail) {
        const matchedUser = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, resolvedInviteeEmail))
            .get();
        if (matchedUser) {
            if (matchedUser.id === userId) {
                return c.json({ error: "Cannot invite yourself" }, 400);
            }
            resolvedInviteeId = matchedUser.id;
            resolvedInviteeEmail = null;
        }
    }

    if (resolvedInviteeId) {
        const alreadyAuthor = await db
            .select()
            .from(paperAuthors)
            .where(
                and(
                    eq(paperAuthors.paperId, paperId),
                    eq(paperAuthors.userId, resolvedInviteeId),
                ),
            )
            .get();
        if (alreadyAuthor)
            return c.json({ error: "User is already an author" }, 409);

        const invitee = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, resolvedInviteeId))
            .get();
        if (!invitee) return c.json({ error: "User not found" }, 404);
    }

    try {
        await db.insert(coauthorInvites).values({
            id: crypto.randomUUID(),
            paperId,
            inviterId: userId,
            inviteeId: resolvedInviteeId,
            inviteeEmail: resolvedInviteeEmail,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("UNIQUE"))
            return c.json({ error: "Invite already sent" }, 409);
        throw e;
    }

    return c.json({ ok: true }, 201);
});

// GET /api/papers/:id/invites — list invites for a paper
papersRoute.get("/:id/invites", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const db = drizzle(c.env.DB);
    const userId = c.get("user").sub;

    const isUploader = await db
        .select()
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, userId),
                eq(paperAuthors.role, "uploader"),
            ),
        )
        .get();
    if (!isUploader) return c.json({ error: "Forbidden" }, 403);

    const inviteRows = await db
        .select()
        .from(coauthorInvites)
        .where(eq(coauthorInvites.paperId, paperId))
        .all();

    const inviteeIds = [
        ...new Set(
            inviteRows
                .map((inv) => inv.inviteeId)
                .filter((v): v is string => typeof v === "string"),
        ),
    ];

    const inviteeRows = inviteeIds.length
        ? await db
            .select({
                id: users.id,
                name: users.name,
                displayName: users.displayName,
            })
            .from(users)
            .where(inArray(users.id, inviteeIds))
            .all()
        : [];

    const inviteeMap = new Map(inviteeRows.map((row) => [row.id, row]));

    const enriched = inviteRows.map((inv) => {
        const invitee = inv.inviteeId ? inviteeMap.get(inv.inviteeId) : null;
        return {
            ...inv,
            inviteeName: invitee
                ? invitee.displayName || invitee.name
                : inv.inviteeEmail,
        };
    });

    return c.json({ invites: enriched });
});

// DELETE /api/papers/:id — delete paper owned by uploader
papersRoute.delete("/:id", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const userId = c.get("user").sub;
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const isUploader = await db
        .select()
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, userId),
                eq(paperAuthors.role, "uploader"),
            ),
        )
        .get();
    if (!isUploader) return c.json({ error: "Forbidden" }, 403);

    const files = await db
        .select({ r2Key: paperFiles.r2Key })
        .from(paperFiles)
        .where(eq(paperFiles.paperId, paperId))
        .all();

    await Promise.all(files.map((f) => c.env.BUCKET.delete(f.r2Key)));
    await db.delete(papers).where(eq(papers.id, paperId));

    return c.json({ ok: true });
});

export default papersRoute;
