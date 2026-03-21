import { Hono, type Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import {
    papers,
    paperFiles,
    paperAuthors,
    paperViews,
    users,
    coauthorInvites,
    orgMembers,
    paperOrgs,
    enableForeignKeys,
    touchUpdatedAt,
    VALID_VENUE_TYPES,
    VALID_CATEGORIES,
    type VenueType,
    type CategoryType,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { validateMagicNumbers } from "../utils/file";

const papersRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_CONCURRENT_UPLOADS = 3;
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
];
const VALID_FILE_TYPES = ["paper", "slides", "poster", "supplementary"];
const VALID_VISIBILITY = ["public", "org_only", "private"];
const MAX_TITLE_LENGTH = 300;
const MAX_ABSTRACT_LENGTH = 5000;
const MAX_LANGUAGE_LENGTH = 32;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const MAX_DOI_LENGTH = 255;
const MAX_VENUE_LENGTH = 255;
const MAX_TAG_LENGTH = 64;
const VIEW_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const VIEW_STATS_RANGE_DAYS = 30;

function formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function formatDbDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function getDateRange(days: number, now = new Date()): string[] {
    const start = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
    ));
    start.setUTCDate(start.getUTCDate() - (days - 1));

    return Array.from({ length: days }, (_, index) => {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + index);
        return formatDateKey(day);
    });
}

function getViewBucket(now = new Date()): number {
    return Math.floor(now.getTime() / VIEW_DEDUPE_WINDOW_MS);
}

function getStatsRangeStart(days: number, now = new Date()): string {
    const start = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
    ));
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return formatDbDateTime(start);
}

async function hashString(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function buildViewerFingerprint(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    paperId: string,
): Promise<string> {
    const user = c.get("user");
    if (user?.sub) {
        // Authenticated users are tracked by their ID
        return hashString(`${c.env.JWT_SECRET}:auth:${paperId}:${user.sub}`);
    }

    // Anonymous users are tracked by IP and User-Agent
    const forwardedFor = c.req.header("CF-Connecting-IP")
        ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
        ?? "unknown-ip";
    const userAgent = c.req.header("User-Agent") ?? "unknown-ua";

    return hashString(
        `${c.env.JWT_SECRET}:anon:${paperId}:${forwardedFor}:${userAgent}`,
    );
}

async function getPaperViewCount(
    db: ReturnType<typeof drizzle>,
    paperId: string,
): Promise<number> {
    const row = await db
        .select({ count: sql<number>`count(*)` })
        .from(paperViews)
        .where(eq(paperViews.paperId, paperId))
        .get();
    return row?.count ?? 0;
}

function sanitizeFilename(filename: string): string {
    const basename = filename.split(/[\\/]/).pop() ?? "";
    const cleaned = basename
        .replace(/\.{2,}/g, ".")
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 120);
    return cleaned || `file-${crypto.randomUUID()}`;
}

function isValidUrlScheme(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
}

async function authorizePaperAccess(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    db: ReturnType<typeof drizzle>,
    paper: { visibility: string; id: string },
) {
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
    } else {
        return { ok: false, status: 403, error: "Forbidden" };
    }

    return { ok: true, user };
}

async function isPaperAuthor(
    db: ReturnType<typeof drizzle>,
    paperId: string,
    userId: string,
): Promise<boolean> {
    const author = await db
        .select({ userId: paperAuthors.userId })
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, userId),
            ),
        )
        .get();

    return !!author;
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
        title.trim().length > MAX_TITLE_LENGTH
    )
        return c.json({ error: `title is required (1-${MAX_TITLE_LENGTH} chars)` }, 400);

    const vis = (meta.visibility as string) || "private";
    if (!VALID_VISIBILITY.includes(vis))
        return c.json({ error: "Invalid visibility" }, 400);

    const venueType = (meta.venueType as string | null | undefined) ?? null;
    if (venueType !== null && !(VALID_VENUE_TYPES as readonly string[]).includes(venueType))
        return c.json({ error: "Invalid venueType" }, 400);

    const category = (meta.category as string | null | undefined) ?? null;
    if (category !== null && !(VALID_CATEGORIES as readonly string[]).includes(category))
        return c.json({ error: "Invalid category" }, 400);

    const externalUrl = (meta.externalUrl as string) || null;
    if (externalUrl && !isValidUrlScheme(externalUrl)) {
        return c.json({ error: "Invalid externalUrl scheme (only http/https allowed)" }, 400);
    }

    if (
        meta.showViewCount !== undefined
        && typeof meta.showViewCount !== "boolean"
    ) {
        return c.json({ error: "showViewCount must be a boolean" }, 400);
    }

    const orgId = meta.orgId as string | undefined;
    if (vis === "org_only" && !orgId) {
        return c.json({ error: "orgId is required for org_only visibility" }, 400);
    }

    const paperId = crypto.randomUUID();
    const userId = c.get("user").sub;

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

    type UploadEntry = {
        file: File;
        fileType: "paper" | "slides" | "poster" | "supplementary";
        safeFilename: string;
        r2Key: string;
    };

    const uploads: UploadEntry[] = [];

    // Validate all file entries before any upload or DB mutation.
    for (let i = 0; ; i++) {
        const fileCandidate = body[`files_${i}`];
        if (!fileCandidate) break;
        if (typeof fileCandidate === "string" || Array.isArray(fileCandidate)) {
            console.error(`Field files_${i} is not a single file`);
            return c.json({ error: `Field files_${i} is not a valid file` }, 400);
        }

        const file = fileCandidate as File;
        if (!(file instanceof File) && typeof (file as any).slice !== "function") {
            console.error(`Field files_${i} is not a valid File/Blob`);
            return c.json({ error: `Field files_${i} is not a valid file` }, 400);
        }

        if (file.size > MAX_FILE_SIZE)
            return c.json(
                { error: `File ${file.name} exceeds 50 MB limit` },
                400,
            );
        if (!ALLOWED_MIME_TYPES.includes(file.type))
            return c.json(
                {
                    error: `File ${file.name} has unsupported type: ${file.type || "unknown"}`,
                },
                400,
            );

        const isValidContent = await validateMagicNumbers(file, file.type);
        if (!isValidContent) {
            console.error(`Magic number validation failed for file ${file.name} (declared: ${file.type})`);
            return c.json(
                { error: `File ${file.name} does not match expected format for ${file.type}` },
                400,
            );
        }

        const ft = (body[`file_types_${i}`] as string) || "paper";
        if (!VALID_FILE_TYPES.includes(ft))
            return c.json({ error: `Invalid file_type: ${ft}` }, 400);

        const safeFilename = sanitizeFilename(file.name);
        const uniqueFilename = `${crypto.randomUUID()}-${safeFilename}`;

        uploads.push({
            file,
            fileType: ft as UploadEntry["fileType"],
            safeFilename,
            r2Key: `papers/${paperId}/${ft}/${uniqueFilename}`,
        });
    }

    if (uploads.length === 0) {
        return c.json({ error: "At least one file is required" }, 400);
    }

    const paperValues: typeof papers.$inferInsert = {
        id: paperId,
        title: title.trim(),
        abstract: (meta.abstract as string) || null,
        visibility: vis as "public" | "org_only" | "private",
        showViewCount: Boolean(meta.showViewCount),
        language: (meta.language as string) || null,
        externalUrl,
        doi: (meta.doi as string) || null,
        venue: (meta.venue as string) || null,
        venueType: venueType as VenueType | null,
        year: meta.year ? Number(meta.year) : null,
        category: category as CategoryType | null,
        tags: meta.tags ? JSON.stringify(meta.tags) : null,
    };

    const uploadedKeys: string[] = [];
    try {
        const errors: unknown[] = [];
        for (let i = 0; i < uploads.length; i += MAX_CONCURRENT_UPLOADS) {
            const chunk = uploads.slice(i, i + MAX_CONCURRENT_UPLOADS);
            const results = await Promise.allSettled(
                chunk.map(async (entry) => {
                    const fileBuffer = await entry.file.arrayBuffer();
                    await c.env.BUCKET.put(entry.r2Key, fileBuffer, {
                        httpMetadata: { contentType: entry.file.type },
                    });
                    return entry.r2Key;
                }),
            );

            for (const result of results) {
                if (result.status === "fulfilled") {
                    uploadedKeys.push(result.value);
                } else {
                    errors.push(result.reason);
                }
            }
        }

        if (errors.length > 0) {
            console.error("File upload errors:", { errors });
            throw errors[0] ?? new Error("An unknown upload error occurred.");
        }

        const insertPaper = db.insert(papers).values(paperValues);
        const insertAuthor = db.insert(paperAuthors).values({ paperId, userId, role: "uploader" });
        const insertFiles = db.insert(paperFiles).values(
            uploads.map((entry) => ({
                id: crypto.randomUUID(),
                paperId,
                r2Key: entry.r2Key,
                fileType: entry.fileType,
                filename: entry.safeFilename,
                sizeBytes: entry.file.size,
                mimeType: entry.file.type || null,
                ...touchUpdatedAt(),
            })),
        );

        type BatchItem = Parameters<typeof db.batch>[0][number];
        const operations: BatchItem[] = [insertPaper, insertAuthor];
        if (vis === "org_only" && orgId) {
            operations.push(db.insert(paperOrgs).values({ paperId, orgId }));
        }
        operations.push(insertFiles);

        await db.batch(operations as [BatchItem, ...BatchItem[]]);
    } catch (error) {
        const cleanupFailures: unknown[] = [];
        try {
            const r2Results = await Promise.allSettled(
                uploadedKeys.map((key) => c.env.BUCKET.delete(key)),
            );
            for (const result of r2Results) {
                if (result.status === "rejected") {
                    cleanupFailures.push(result.reason);
                }
            }
        } catch (cleanupError) {
            cleanupFailures.push(cleanupError);
        }

        try {
            const d1Results = await Promise.allSettled([
                db.delete(paperFiles).where(eq(paperFiles.paperId, paperId)),
                db.delete(paperOrgs).where(eq(paperOrgs.paperId, paperId)),
                db.delete(paperAuthors).where(eq(paperAuthors.paperId, paperId)),
            ]);
            for (const result of d1Results) {
                if (result.status === "rejected") {
                    cleanupFailures.push(result.reason);
                }
            }

            const paperDeleteResults = await Promise.allSettled([
                db.delete(papers).where(eq(papers.id, paperId)),
            ]);
            for (const result of paperDeleteResults) {
                if (result.status === "rejected") {
                    cleanupFailures.push(result.reason);
                }
            }
        } catch (cleanupError) {
            cleanupFailures.push(cleanupError);
        }

        if (cleanupFailures.length > 0) {
            console.error("Cleanup failures for paperId:", paperId, cleanupFailures);
        }

        throw error;
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
        return c.json({ error: access.error }, access.status as any);
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
    const publicViewCount = paper.showViewCount
        ? await getPaperViewCount(db, paperId)
        : null;

    return c.json({
        paper: {
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            visibility: paper.visibility,
            showViewCount: paper.showViewCount,
            publicViewCount,
            language: paper.language,
            externalUrl: paper.externalUrl,
            doi: paper.doi,
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

// POST /api/papers/:id/view — record a deduplicated paper view
papersRoute.post("/:id/view", async (c) => {
    const paperId = c.req.param("id");
    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const paper = await db
        .select({ id: papers.id, visibility: papers.visibility })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const access = await authorizePaperAccess(c, db, paper);
    if (!access.ok) {
        return c.json({ error: access.error }, access.status as any);
    }

    const viewerFingerprint = await buildViewerFingerprint(c, paperId);
    const viewBucket = getViewBucket();
    const existing = await db
        .select({ id: paperViews.id })
        .from(paperViews)
        .where(
            and(
                eq(paperViews.paperId, paperId),
                eq(paperViews.viewerFingerprint, viewerFingerprint),
                eq(paperViews.viewBucket, viewBucket),
            ),
        )
        .get();

    if (existing) {
        return c.json({ counted: false });
    }

    try {
        await db.insert(paperViews).values({
            id: crypto.randomUUID(),
            paperId,
            viewerFingerprint,
            viewBucket,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("UNIQUE") || message.includes("unique")) {
            return c.json({ counted: false });
        }
        throw error;
    }

    return c.json({ counted: true }, 201);
});

// GET /api/papers/:id/stats — author-only paper statistics
papersRoute.get("/:id/stats", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const userId = c.get("user").sub;
    const db = drizzle(c.env.DB);

    const paper = await db
        .select({ id: papers.id })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const author = await isPaperAuthor(db, paperId, userId);
    if (!author) return c.json({ error: "Forbidden" }, 403);

    const since30Days = getStatsRangeStart(VIEW_STATS_RANGE_DAYS);
    const since7Days = getStatsRangeStart(7);

    const [totalViewsRow, last30DaysRow, last7DaysRow, dailyRows] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(paperViews)
            .where(eq(paperViews.paperId, paperId))
            .get(),
        db
            .select({ count: sql<number>`count(*)` })
            .from(paperViews)
            .where(
                and(
                    eq(paperViews.paperId, paperId),
                    gte(paperViews.viewedAt, since30Days),
                ),
            )
            .get(),
        db
            .select({ count: sql<number>`count(*)` })
            .from(paperViews)
            .where(
                and(
                    eq(paperViews.paperId, paperId),
                    gte(paperViews.viewedAt, since7Days),
                ),
            )
            .get(),
        db
            .select({
                date: sql<string>`date(${paperViews.viewedAt})`,
                count: sql<number>`count(*)`,
            })
            .from(paperViews)
            .where(
                and(
                    eq(paperViews.paperId, paperId),
                    gte(paperViews.viewedAt, since30Days),
                ),
            )
            .groupBy(sql`date(${paperViews.viewedAt})`)
            .all(),
    ]);

    const dailyViewCountMap = new Map(
        dailyRows.map((row) => [row.date, row.count]),
    );
    const dailyViews = getDateRange(VIEW_STATS_RANGE_DAYS).map((date) => ({
        date,
        count: dailyViewCountMap.get(date) ?? 0,
    }));

    return c.json({
        totalViews: totalViewsRow?.count ?? 0,
        last7DaysViews: last7DaysRow?.count ?? 0,
        last30DaysViews: last30DaysRow?.count ?? 0,
        dailyViews,
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
        return c.json({ error: access.error }, access.status as any);
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
        return c.json({ error: access.error }, access.status as any);
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
        return c.json({ error: access.error }, access.status as any);
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
            ...touchUpdatedAt(),
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
        ...inviteRows.reduce((acc, inv) => {
            if (typeof inv.inviteeId === "string") {
                acc.add(inv.inviteeId);
            }
            return acc;
        }, new Set<string>()),
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

// PATCH /api/papers/:id — edit paper metadata
papersRoute.patch("/:id", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const userId = c.get("user").sub;
    let parsedBody: unknown;
    try {
        parsedBody = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        return c.json({ error: "Invalid JSON body" }, 400);
    }
    const body = parsedBody as Record<string, unknown>;

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const paper = await db
        .select({ id: papers.id, visibility: papers.visibility })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const isAuthor = await db
        .select()
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, userId)
            )
        )
        .get();
    if (!isAuthor) return c.json({ error: "Forbidden" }, 403);

    const updates: Record<string, any> = { ...touchUpdatedAt() };
    let hasRealUpdates = false;

    if ("title" in body) {
        if (typeof body.title !== "string") {
            return c.json({ error: "title must be a string" }, 400);
        }
        const trimmedTitle = body.title.trim();
        if (trimmedTitle.length === 0 || trimmedTitle.length > MAX_TITLE_LENGTH) {
            return c.json({ error: `title is required (1-${MAX_TITLE_LENGTH} chars)` }, 400);
        }
        updates.title = trimmedTitle;
        hasRealUpdates = true;
    }
    if ("abstract" in body) {
        if (!(typeof body.abstract === "string" || body.abstract === null)) {
            return c.json({ error: "abstract must be a string or null" }, 400);
        }
        const abstract = typeof body.abstract === "string" ? body.abstract.trim() : null;
        if (abstract && abstract.length > MAX_ABSTRACT_LENGTH) {
            return c.json({ error: `abstract must be ${MAX_ABSTRACT_LENGTH} chars or less` }, 400);
        }
        updates.abstract = abstract || null;
        hasRealUpdates = true;
    }
    if ("visibility" in body) {
        if (typeof body.visibility !== "string" || !VALID_VISIBILITY.includes(body.visibility)) {
            return c.json({ error: "Invalid visibility" }, 400);
        }
        if (body.visibility === "org_only" && paper.visibility !== "org_only") {
            return c.json(
                { error: "Changing visibility to org_only is not supported in edit flow" },
                400,
            );
        }
        updates.visibility = body.visibility;
        hasRealUpdates = true;
    }
    if ("showViewCount" in body) {
        if (typeof body.showViewCount !== "boolean") {
            return c.json({ error: "showViewCount must be a boolean" }, 400);
        }
        updates.showViewCount = body.showViewCount;
        hasRealUpdates = true;
    }
    if ("language" in body) {
        if (!(typeof body.language === "string" || body.language === null)) {
            return c.json({ error: "language must be a string or null" }, 400);
        }
        const language = typeof body.language === "string" ? body.language.trim() : null;
        if (language && language.length > MAX_LANGUAGE_LENGTH) {
            return c.json({ error: `language must be ${MAX_LANGUAGE_LENGTH} chars or less` }, 400);
        }
        updates.language = language || null;
        hasRealUpdates = true;
    }
    if ("externalUrl" in body) {
        if (!(typeof body.externalUrl === "string" || body.externalUrl === null)) {
            return c.json({ error: "externalUrl must be a string or null" }, 400);
        }
        const externalUrl = typeof body.externalUrl === "string" ? body.externalUrl.trim() : null;
        if (externalUrl && externalUrl.length > MAX_EXTERNAL_URL_LENGTH) {
            return c.json({ error: `externalUrl must be ${MAX_EXTERNAL_URL_LENGTH} chars or less` }, 400);
        }
        if (externalUrl && !isValidUrlScheme(externalUrl)) {
            return c.json({ error: "Invalid externalUrl scheme (only http/https allowed)" }, 400);
        }
        updates.externalUrl = externalUrl || null;
        hasRealUpdates = true;
    }
    if ("doi" in body) {
        if (!(typeof body.doi === "string" || body.doi === null)) {
            return c.json({ error: "doi must be a string or null" }, 400);
        }
        const doi = typeof body.doi === "string" ? body.doi.trim() : null;
        if (doi && doi.length > MAX_DOI_LENGTH) {
            return c.json({ error: `doi must be ${MAX_DOI_LENGTH} chars or less` }, 400);
        }
        updates.doi = doi || null;
        hasRealUpdates = true;
    }
    if ("venue" in body) {
        if (!(typeof body.venue === "string" || body.venue === null)) {
            return c.json({ error: "venue must be a string or null" }, 400);
        }
        const venue = typeof body.venue === "string" ? body.venue.trim() : null;
        if (venue && venue.length > MAX_VENUE_LENGTH) {
            return c.json({ error: `venue must be ${MAX_VENUE_LENGTH} chars or less` }, 400);
        }
        updates.venue = venue || null;
        hasRealUpdates = true;
    }
    if ("venueType" in body) {
        if (!(typeof body.venueType === "string" || body.venueType === null)) {
            return c.json({ error: "venueType must be a string or null" }, 400);
        }
        if (
            body.venueType &&
            !(VALID_VENUE_TYPES as readonly string[]).includes(body.venueType)
        ) {
            return c.json({ error: "Invalid venueType" }, 400);
        }
        updates.venueType = body.venueType || null;
        hasRealUpdates = true;
    }
    if ("year" in body) {
        const { year } = body;
        if (year !== null) {
            if (typeof year !== "number" || Number.isNaN(year)) {
                return c.json({ error: "year must be a number or null" }, 400);
            }
        }
        updates.year = year;
        hasRealUpdates = true;
    }
    if ("category" in body) {
        if (!(typeof body.category === "string" || body.category === null)) {
            return c.json({ error: "category must be a string or null" }, 400);
        }
        if (
            body.category &&
            !(VALID_CATEGORIES as readonly string[]).includes(body.category)
        ) {
            return c.json({ error: "Invalid category" }, 400);
        }
        updates.category = body.category || null;
        hasRealUpdates = true;
    }
    if ("tags" in body) {
        if (Array.isArray(body.tags)) {
            const normalizedTags: string[] = [];
            for (const tag of body.tags) {
                if (typeof tag !== "string") {
                    return c.json({ error: "each tag must be a string" }, 400);
                }
                const normalizedTag = tag.trim();
                if (normalizedTag.length === 0) continue;
                if (normalizedTag.length > MAX_TAG_LENGTH) {
                    return c.json({ error: `each tag must be ${MAX_TAG_LENGTH} chars or less` }, 400);
                }
                normalizedTags.push(normalizedTag);
            }
            updates.tags = normalizedTags.length > 0 ? JSON.stringify(normalizedTags) : null;
        } else if (body.tags === null) {
            updates.tags = null;
        } else {
            return c.json({ error: "tags must be an array or null" }, 400);
        }
        hasRealUpdates = true;
    }
    if (!hasRealUpdates) {
        return c.json({ error: "No valid fields to update" }, 400);
    }

    await db.update(papers).set(updates).where(eq(papers.id, paperId));
    return c.json({ ok: true });
});

export default papersRoute;
