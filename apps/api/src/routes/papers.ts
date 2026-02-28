import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
    papers,
    paperFiles,
    paperAuthors,
    users,
    coauthorInvites,
    enableForeignKeys,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

const papersRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
];
const VALID_FILE_TYPES = ["paper", "slides", "poster", "supplementary"];
const VALID_VISIBILITY = ["public", "org_only", "private"];

// POST /api/papers — create paper + upload files
papersRoute.post("/", authMiddleware, async (c) => {
    const body = await c.req.parseBody({ all: true });

    const metadataStr = body["metadata"];
    if (typeof metadataStr !== "string")
        return c.json({ error: "metadata field is required" }, 400);

    let meta: Record<string, unknown>;
    try {
        meta = JSON.parse(metadataStr);
    } catch {
        return c.json({ error: "Invalid metadata JSON" }, 400);
    }

    const title = meta.title as string | undefined;
    if (
        !title ||
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > 300
    )
        return c.json({ error: "title is required (1-300 chars)" }, 400);

    const vis = (meta.visibility as string) || "private";
    if (!VALID_VISIBILITY.includes(vis))
        return c.json({ error: "Invalid visibility" }, 400);

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const paperId = crypto.randomUUID();
    const userId = c.get("user").sub;

    await db.insert(papers).values({
        id: paperId,
        title: title.trim(),
        abstract: (meta.abstract as string) || null,
        visibility: vis as "public" | "org_only" | "private",
        language: (meta.language as string) || null,
        externalUrl: (meta.externalUrl as string) || null,
        doi: (meta.doi as string) || null,
        venue: (meta.venue as string) || null,
        venueType: (meta.venueType as string) || null,
        year: meta.year ? Number(meta.year) : null,
        category: (meta.category as string) || null,
        tags: meta.tags ? JSON.stringify(meta.tags) : null,
    });

    await db
        .insert(paperAuthors)
        .values({ paperId, userId, role: "uploader" });

    // Handle indexed files: files_0, file_types_0, files_1, …
    for (let i = 0; ; i++) {
        const file = body[`files_${i}`];
        if (!file || !(file instanceof File)) break;

        if (file.size > MAX_FILE_SIZE)
            return c.json(
                { error: `File ${file.name} exceeds 50 MB limit` },
                400,
            );
        if (file.type && !ALLOWED_MIME_TYPES.includes(file.type))
            return c.json(
                {
                    error: `File ${file.name} has unsupported type: ${file.type}`,
                },
                400,
            );

        const ft = (body[`file_types_${i}`] as string) || "paper";
        if (!VALID_FILE_TYPES.includes(ft))
            return c.json({ error: `Invalid file_type: ${ft}` }, 400);

        const r2Key = `papers/${paperId}/${ft}/${file.name}`;
        await c.env.BUCKET.put(r2Key, file.stream(), {
            httpMetadata: { contentType: file.type },
        });

        await db.insert(paperFiles).values({
            id: crypto.randomUUID(),
            paperId,
            r2Key,
            fileType: ft as "paper" | "slides" | "poster" | "supplementary",
            filename: file.name,
            sizeBytes: file.size,
            mimeType: file.type || null,
        });
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

    // Non-public papers require authentication and authorship
    if (paper.visibility !== "public") {
        const token = getCookie(c, "token");
        if (!token) return c.json({ error: "Unauthorized" }, 401);
        try {
            const payload = await verify(token, c.env.JWT_SECRET);
            const isAuthor = await db
                .select()
                .from(paperAuthors)
                .where(
                    and(
                        eq(paperAuthors.paperId, paperId),
                        eq(paperAuthors.userId, payload.sub as string),
                    ),
                )
                .get();
            if (!isAuthor)
                return c.json({ error: "Forbidden" }, 403);
        } catch {
            return c.json({ error: "Unauthorized" }, 401);
        }
    }

    const files = await db
        .select()
        .from(paperFiles)
        .where(eq(paperFiles.paperId, paperId))
        .all();

    const authors = await db
        .select({
            userId: paperAuthors.userId,
            role: paperAuthors.role,
            name: users.name,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(paperAuthors)
        .innerJoin(users, eq(paperAuthors.userId, users.id))
        .where(eq(paperAuthors.paperId, paperId))
        .all();

    return c.json({ paper, files, authors });
});

// POST /api/papers/:id/invites — send coauthor invite
papersRoute.post("/:id/invites", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const { inviteeId } = await c.req.json<{ inviteeId: string }>();
    if (!inviteeId) return c.json({ error: "inviteeId is required" }, 400);

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    // Only uploaders can invite
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

    // Already an author?
    const alreadyAuthor = await db
        .select()
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, inviteeId),
            ),
        )
        .get();
    if (alreadyAuthor)
        return c.json({ error: "User is already an author" }, 409);

    // Invitee exists?
    const invitee = await db
        .select()
        .from(users)
        .where(eq(users.id, inviteeId))
        .get();
    if (!invitee) return c.json({ error: "User not found" }, 404);

    try {
        await db.insert(coauthorInvites).values({
            id: crypto.randomUUID(),
            paperId,
            inviterId: userId,
            inviteeId,
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

    const enriched = await Promise.all(
        inviteRows.map(async (inv) => {
            const invitee = inv.inviteeId
                ? await db
                    .select({
                        name: users.name,
                        displayName: users.displayName,
                    })
                    .from(users)
                    .where(eq(users.id, inv.inviteeId))
                    .get()
                : null;
            return {
                ...inv,
                inviteeName: invitee
                    ? invitee.displayName || invitee.name
                    : inv.inviteeEmail,
            };
        }),
    );

    return c.json({ invites: enriched });
});

export default papersRoute;
