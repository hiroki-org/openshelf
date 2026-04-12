import { Hono, type Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, sql } from "drizzle-orm";
import {
    papers,
    paperFiles,
    paperAuthors,
    paperStatsDaily,
    paperStatsTotal,
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
import { buildCitation, isCitationFormat } from "../utils/citation";
import pMap from "p-map";

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
const MAX_DESCRIPTION_LENGTH = 50000;
const MAX_LANGUAGE_LENGTH = 32;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const MAX_DOI_LENGTH = 255;
const MAX_VENUE_LENGTH = 255;
const MAX_TAG_LENGTH = 64;
const MAX_REFERRER_LENGTH = 2048;
const TRACK_DEDUP_RETENTION_DAYS = 90;
const TRACKABLE_EVENTS = ["view", "download", "preview"] as const;
const TRACK_STATS_ALLOWED_DAYS = [7, 30, 90, 365] as const;
const BOT_USER_AGENT_KEYWORDS = [
    "bot",
    "crawler",
    "spider",
    "googlebot",
    "bingbot",
    "facebookexternalhit",
    "bytespider",
];

type TrackEvent = typeof TRACKABLE_EVENTS[number];

function formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function formatDbDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function toIsoUtc(value: string | null | undefined): string | null {
    if (!value) return null;
    return new Date(value.replace(" ", "T") + "Z").toISOString();
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

function isTrackEvent(value: unknown): value is TrackEvent {
    return typeof value === "string"
        && (TRACKABLE_EVENTS as readonly string[]).includes(value);
}

function parseTrackDays(value: string | undefined): number | null {
    if (value === undefined) return 30;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    return (TRACK_STATS_ALLOWED_DAYS as readonly number[]).includes(parsed)
        ? parsed
        : null;
}

function normalizeReferrer(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, MAX_REFERRER_LENGTH);
}

/**
 * `isBotUserAgent` treats missing or empty User-Agent values as non-bot.
 * Requests without a User-Agent header are therefore counted as human traffic.
 */
function isBotUserAgent(userAgent: string | undefined): boolean {
    if (!userAgent) return false;
    const normalized = userAgent.toLowerCase();
    return BOT_USER_AGENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getClientIp(c: Context<{ Bindings: Env; Variables: Variables }>): string {
    return c.req.header("CF-Connecting-IP")
        ?? c.req.header("cf-connecting-ip")
        ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
        ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
        ?? "unknown-ip";
}

async function runInBackground(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    promise: Promise<unknown>,
): Promise<void> {
    let executionCtx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    try {
        executionCtx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    } catch {
        executionCtx = undefined;
    }
    if (executionCtx?.waitUntil) {
        executionCtx.waitUntil(promise);
        return;
    }
    await promise;
}

async function buildTrackSessionHash(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    date: string,
    paperId: string,
): Promise<string> {
    const ip = getClientIp(c);
    return hashString(`${c.env.JWT_SECRET}:track:${paperId}:${ip}:${date}`);
}

function eventIncrements(event: TrackEvent) {
    return {
        views: event === "view" ? 1 : 0,
        downloads: event === "download" ? 1 : 0,
        previews: event === "preview" ? 1 : 0,
    };
}

type RecordTrackEventInput = {
    db: Env["DB"];
    paperId: string;
    event: TrackEvent;
    date: string;
    sessionHash: string;
    referrer: string | null;
};

async function recordTrackEvent({
    db,
    paperId,
    event,
    date,
    sessionHash,
    referrer,
}: RecordTrackEventInput): Promise<boolean> {
    const increments = eventIncrements(event);
    const dedupStmt = db
        .prepare(`
            INSERT INTO paper_stats_dedup (paper_id, event, date, session_hash, referrer)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(paper_id, event, date, session_hash) DO NOTHING
        `)
        .bind(paperId, event, date, sessionHash, referrer);

    const dailyStmt = db
        .prepare(`
            INSERT INTO paper_stats_daily (paper_id, date, views, downloads, previews)
            SELECT ?1, ?2, ?3, ?4, ?5
            WHERE changes() > 0
            ON CONFLICT(paper_id, date) DO UPDATE SET
                views = views + excluded.views,
                downloads = downloads + excluded.downloads,
                previews = previews + excluded.previews
        `)
        .bind(
            paperId,
            date,
            increments.views,
            increments.downloads,
            increments.previews,
        );

    const totalStmt = db
        .prepare(`
            INSERT INTO paper_stats_total (paper_id, total_views, total_downloads, total_previews)
            SELECT ?1, ?2, ?3, ?4
            WHERE changes() > 0
            ON CONFLICT(paper_id) DO UPDATE SET
                total_views = total_views + excluded.total_views,
                total_downloads = total_downloads + excluded.total_downloads,
                total_previews = total_previews + excluded.total_previews,
                last_updated = datetime('now')
        `)
        .bind(
            paperId,
            increments.views,
            increments.downloads,
            increments.previews,
        );

    const cleanupStmt = db
        .prepare(`
            DELETE FROM paper_stats_dedup
            WHERE date < date(?1, ?2)
        `)
        .bind(date, `-${TRACK_DEDUP_RETENTION_DAYS} days`);

    const [dedupResult] = await db.batch([dedupStmt, dailyStmt, totalStmt, cleanupStmt]);
    const changes = dedupResult?.meta?.changes;
    return typeof changes === "number" ? changes > 0 : true;
}

async function hashString(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function getPaperPublicStats(
    db: ReturnType<typeof drizzle>,
    paperId: string,
): Promise<{ views: number; downloads: number }> {
    const row = await db
        .select({
            views: paperStatsTotal.totalViews,
            downloads: paperStatsTotal.totalDownloads,
        })
        .from(paperStatsTotal)
        .where(eq(paperStatsTotal.paperId, paperId))
        .get();
    return {
        views: row?.views ?? 0,
        downloads: row?.downloads ?? 0,
    };
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


// In-memory token cache to prevent repeated JWT verifications for the same token
// within the same worker isolate. Maps token -> { payload: { sub: string }, expiresAt: number }
const tokenCache = new Map<string, { payload: { sub: string }; expiresAt: number }>();
const inFlightVerifications = new Map<string, Promise<{ sub: string; exp?: number }>>();
const MAX_CACHE_SIZE = 1000;
const TOKEN_CACHE_MAX_AGE_MS = 60 * 1000;

function purgeExpiredTokenCache(now: number): void {
    for (const [cachedToken, entry] of tokenCache.entries()) {
        if (entry.expiresAt <= now) {
            tokenCache.delete(cachedToken);
        }
    }
}

async function authorizePaperAccess(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    db: ReturnType<typeof drizzle>,
    paper: { visibility: string; id: string },
) {
    if (paper.visibility === "public") return { ok: true };

    const authHeader = c.req.header("Authorization");
    const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!rawToken) {
        return { ok: false, status: 401, error: "Unauthorized" };
    }

    const token = `${c.env.JWT_SECRET}:${rawToken}`;
    let user: { sub: string };
    const now = Date.now();
    const cached = tokenCache.get(token);

    if (cached && cached.expiresAt > now) {
        user = cached.payload;
    } else {
        if (cached) {
            tokenCache.delete(token);
        }

        let verifyPromise = inFlightVerifications.get(token);
        if (!verifyPromise) {
            verifyPromise = (async () => {
                const { verify } = await import("hono/jwt");
                const verified = (await verify(rawToken, c.env.JWT_SECRET, "HS256")) as { sub: string; exp?: number };

                const postVerifyNow = Date.now();
                if (tokenCache.size >= MAX_CACHE_SIZE) {
                    purgeExpiredTokenCache(postVerifyNow);
                    if (tokenCache.size >= MAX_CACHE_SIZE) {
                        tokenCache.delete(tokenCache.keys().next().value!);
                    }
                }
                const jwtExpiresAt = verified.exp ? verified.exp * 1000 : postVerifyNow + TOKEN_CACHE_MAX_AGE_MS;
                const expiresAt = Math.min(jwtExpiresAt, postVerifyNow + TOKEN_CACHE_MAX_AGE_MS);
                tokenCache.set(token, { payload: { sub: verified.sub }, expiresAt });
                return verified;
            })();

            inFlightVerifications.set(token, verifyPromise);
        }

        try {
            user = await verifyPromise;
        } catch {
            return { ok: false, status: 401, error: "Invalid token" };
        } finally {
            inFlightVerifications.delete(token);
        }
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


type ParsedMetadata = {
    title: string;
    abstract: string | null;
    visibility: "public" | "org_only" | "private";
    showViewCount: boolean;
    language: string | null;
    externalUrl: string | null;
    doi: string | null;
    venue: string | null;
    venueType: VenueType | null;
    year: number | null;
    category: CategoryType | null;
    tags: string | null;
    orgId?: string;
};

function parseAndValidateMetadata(c: Context, metadataStr: string): { errorResponse?: Response; data?: ParsedMetadata } {
    let meta: Record<string, unknown>;
    try {
        meta = JSON.parse(metadataStr);
    } catch {
        return { errorResponse: c.json({ error: "Invalid metadata JSON" }, 400) };
    }

    const title = meta.title as string | undefined;
    if (
        !title ||
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > MAX_TITLE_LENGTH
    )
        return { errorResponse: c.json({ error: `title is required (1-${MAX_TITLE_LENGTH} chars)` }, 400) };

    const vis = (meta.visibility as string) || "private";
    if (!VALID_VISIBILITY.includes(vis))
        return { errorResponse: c.json({ error: "Invalid visibility" }, 400) };

    const venueType = (meta.venueType as string | null | undefined) ?? null;
    if (venueType !== null && !(VALID_VENUE_TYPES as readonly string[]).includes(venueType))
        return { errorResponse: c.json({ error: "Invalid venueType" }, 400) };

    const category = (meta.category as string | null | undefined) ?? null;
    if (category !== null && !(VALID_CATEGORIES as readonly string[]).includes(category))
        return { errorResponse: c.json({ error: "Invalid category" }, 400) };

    const externalUrl = (meta.externalUrl as string) || null;
    if (externalUrl && !isValidUrlScheme(externalUrl)) {
        return { errorResponse: c.json({ error: "Invalid externalUrl scheme (only http/https allowed)" }, 400) };
    }

    if (
        meta.showViewCount !== undefined
        && typeof meta.showViewCount !== "boolean"
    ) {
        return { errorResponse: c.json({ error: "showViewCount must be a boolean" }, 400) };
    }

    const orgId = meta.orgId as string | undefined;
    if (vis === "org_only" && !orgId) {
        return { errorResponse: c.json({ error: "orgId is required for org_only visibility" }, 400) };
    }

    return {
        data: {
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
            orgId,
        }
    };
}


type UploadEntry = {
    file: File;
    fileType: "paper" | "slides" | "poster" | "supplementary";
    safeFilename: string;
    r2Key: string;
};

async function prepareUploadEntries(c: Context, body: Record<string, string | File | (string | File)[]>, paperId: string): Promise<{ errorResponse?: Response; uploads?: UploadEntry[] }> {
    const uploads: UploadEntry[] = [];

    // Validate all file entries before any upload or DB mutation.
    for (let i = 0; body[`files_${i}`]; i++) {
        const fileCandidate = body[`files_${i}`];

        if (typeof fileCandidate === "string" || Array.isArray(fileCandidate)) {
            console.error(`Field files_${i} is not a single file`);
            return { errorResponse: c.json({ error: `Field files_${i} is not a valid file` }, 400) };
        }

        const file = fileCandidate as File;
        if (!(file instanceof File) && typeof (file as any).slice !== "function") {
            console.error(`Field files_${i} is not a valid File/Blob`);
            return { errorResponse: c.json({ error: `Field files_${i} is not a valid file` }, 400) };
        }

        if (file.size > MAX_FILE_SIZE)
            return { errorResponse: c.json(
                { error: `File ${file.name} exceeds 50 MB limit` },
                400,
            ) };
        if (!ALLOWED_MIME_TYPES.includes(file.type))
            return { errorResponse: c.json(
                {
                    error: `File ${file.name} has unsupported type: ${file.type || "unknown"}`,
                },
                400,
            ) };

        const isValidContent = await validateMagicNumbers(file, file.type);
        if (!isValidContent) {
            console.error(`Magic number validation failed for file ${file.name} (declared: ${file.type})`);
            return { errorResponse: c.json(
                { error: `File ${file.name} does not match expected format for ${file.type}` },
                400,
            ) };
        }

        const ft = (body[`file_types_${i}`] as string) || "paper";
        if (!VALID_FILE_TYPES.includes(ft))
            return { errorResponse: c.json({ error: `Invalid file_type: ${ft}` }, 400) };

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
        return { errorResponse: c.json({ error: "At least one file is required" }, 400) };
    }

    return { uploads };
}

// POST /api/papers — create paper + upload files
papersRoute.post("/", authMiddleware, async (c) => {
    const body = await c.req.parseBody({ all: true });

    const metadataStr = body["metadata"];
    if (typeof metadataStr !== "string")
        return c.json({ error: "metadata field is required" }, 400);

    const { errorResponse, data: meta } = parseAndValidateMetadata(c, metadataStr);
    if (errorResponse) return errorResponse;
    if (!meta) return c.json({ error: "Unexpected parsing error" }, 500); // Should not happen based on helper logic

    const paperId = crypto.randomUUID();
    const userId = c.get("user").sub;

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    if (meta.visibility === "org_only" && meta.orgId) {
        const membership = await db
            .select({ orgId: orgMembers.orgId })
            .from(orgMembers)
            .where(
                and(
                    eq(orgMembers.orgId, meta.orgId),
                    eq(orgMembers.userId, userId),
                ),
            )
            .get();
        if (!membership) {
            console.error(`Membership check failed for userId: ${userId}, orgId: ${meta.orgId}`);
            return c.json({ error: "Invalid orgId or not a member" }, 403);
        }
    }

    const { errorResponse: uploadError, uploads } = await prepareUploadEntries(c, body, paperId);
    if (uploadError) return uploadError;
    if (!uploads) return c.json({ error: "Unexpected upload processing error" }, 500); // Should not happen based on helper logic

    const paperValues: typeof papers.$inferInsert = {
        id: paperId,
        title: meta.title,
        abstract: meta.abstract,
        visibility: meta.visibility,
        showViewCount: meta.showViewCount,
        language: meta.language,
        externalUrl: meta.externalUrl,
        doi: meta.doi,
        venue: meta.venue,
        venueType: meta.venueType,
        year: meta.year,
        category: meta.category,
        tags: meta.tags,
    };

    const uploadedKeys: string[] = [];
    try {
        const errors: unknown[] = [];
        await pMap(
            uploads,
            async (entry) => {
                try {
                    await c.env.BUCKET.put(entry.r2Key, entry.file.stream() as any, {
                        httpMetadata: { contentType: entry.file.type },
                    });
                    uploadedKeys.push(entry.r2Key);
                } catch (e) {
                    errors.push(e);
                }
            },
            { concurrency: MAX_CONCURRENT_UPLOADS, stopOnError: false }
        );

        if (errors.length > 0) {
            console.error("File upload errors:", { errors });
            throw errors[0] ?? new Error("An unknown upload error occurred.");
        }

        await db.insert(papers).values(paperValues);

        await db
            .insert(paperAuthors)
            .values({ paperId, userId, role: "uploader" });

        if (meta.visibility === "org_only" && meta.orgId) {
            await db.insert(paperOrgs).values({ paperId, orgId: meta.orgId });
        }

        await db.insert(paperFiles).values(
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
    } catch (error) {
        const chunks = [];
        for (let i = 0; i < uploadedKeys.length; i += 1000) {
            chunks.push(c.env.BUCKET.delete(uploadedKeys.slice(i, i + 1000)));
        }
        await Promise.allSettled(chunks);
        await db.delete(papers).where(eq(papers.id, paperId));
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
    const publicStats = paper.showViewCount
        ? await getPaperPublicStats(db, paperId)
        : null;

    return c.json({
        paper: {
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            description: paper.description,
            descriptionUpdatedAt: toIsoUtc(paper.descriptionUpdatedAt),
            visibility: paper.visibility,
            showViewCount: paper.showViewCount,
            publicViewCount: publicStats?.views ?? null,
            publicDownloadCount: publicStats?.downloads ?? null,
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

// GET /api/papers/:id/cite — generate citation text
papersRoute.get("/:id/cite", async (c) => {
    const paperId = c.req.param("id");
    const formatRaw = c.req.query("format") ?? "bibtex";
    const format = isCitationFormat(formatRaw) ? formatRaw : "bibtex";
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

    const authors = await db
        .select({
            name: users.name,
            displayName: users.displayName,
        })
        .from(paperAuthors)
        .innerJoin(users, eq(paperAuthors.userId, users.id))
        .where(eq(paperAuthors.paperId, paperId))
        .all();

    const citation = buildCitation(
        {
            id: paper.id,
            title: paper.title,
            venue: paper.venue,
            venueType: paper.venueType,
            year: paper.year,
            category: paper.category,
            doi: paper.doi,
            externalUrl: paper.externalUrl,
        },
        authors,
        format,
        c.env.FRONTEND_URL,
    );

    return c.json(citation);
});

// POST /api/papers/:id/track — record daily stats events
papersRoute.post("/:id/track", async (c) => {
    const paperId = c.req.param("id");
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
    const payload = body as { event?: unknown; referrer?: unknown };
    if (!isTrackEvent(payload.event)) {
        return c.json({ error: "event must be one of view, download, preview" }, 400);
    }

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

    if (isBotUserAgent(c.req.header("User-Agent"))) {
        return new Response(null, { status: 204 });
    }

    const referrer = normalizeReferrer(payload.referrer);
    const date = formatDateKey(new Date());
    const sessionHash = await buildTrackSessionHash(c, date, paperId);

    await runInBackground(
        c,
        recordTrackEvent({
            db: c.env.DB,
            paperId,
            event: payload.event,
            date,
            sessionHash,
            referrer,
        }).catch((error) => {
            console.error("Failed to record paper track event", {
                paperId,
                event: payload.event,
                error,
            });
        }),
    );

    return new Response(null, { status: 204 });
});

// GET /api/papers/:id/stats — author-only paper statistics
papersRoute.get("/:id/stats", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const userId = c.get("user").sub;
    const db = drizzle(c.env.DB);
    const days = parseTrackDays(c.req.query("days"));
    if (days === null) {
        return c.json({ error: "days must be one of 7, 30, 90, 365" }, 400);
    }

    const paper = await db
        .select({ id: papers.id })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

    const author = await isPaperAuthor(db, paperId, userId);
    if (!author) return c.json({ error: "Forbidden" }, 403);

    const dateRange = getDateRange(days);
    const sinceDate = dateRange[0];

    const [totalRow, dailyRows] = await Promise.all([
        db
            .select({
                views: paperStatsTotal.totalViews,
                downloads: paperStatsTotal.totalDownloads,
                previews: paperStatsTotal.totalPreviews,
            })
            .from(paperStatsTotal)
            .where(eq(paperStatsTotal.paperId, paperId))
            .get(),
        db
            .select({
                date: paperStatsDaily.date,
                views: paperStatsDaily.views,
                downloads: paperStatsDaily.downloads,
                previews: paperStatsDaily.previews,
            })
            .from(paperStatsDaily)
            .where(
                and(
                    eq(paperStatsDaily.paperId, paperId),
                    gte(paperStatsDaily.date, sinceDate),
                ),
            )
            .all(),
    ]);

    const dailyMap = new Map(
        dailyRows.map((row) => [row.date, row]),
    );
    const daily = dateRange.map((date) => {
        const row = dailyMap.get(date);
        return {
            date,
            views: row?.views ?? 0,
            downloads: row?.downloads ?? 0,
            previews: row?.previews ?? 0,
        };
    });

    return c.json({
        total: {
            views: totalRow?.views ?? 0,
            downloads: totalRow?.downloads ?? 0,
            previews: totalRow?.previews ?? 0,
        },
        daily,
        days,
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
        .select({
            coauthorInvites: coauthorInvites,
            users: {
                id: users.id,
                name: users.name,
                displayName: users.displayName,
            }
        })
        .from(coauthorInvites)
        .leftJoin(users, eq(coauthorInvites.inviteeId, users.id))
        .where(eq(coauthorInvites.paperId, paperId))
        .all();

    const enriched = inviteRows.map((row) => {
        const inv = row.coauthorInvites;
        const invitee = row.users && row.users.id ? row.users : null;
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

    const keys = files.map((f) => f.r2Key);
    const chunks = [];
    for (let i = 0; i < keys.length; i += 1000) {
        chunks.push(c.env.BUCKET.delete(keys.slice(i, i + 1000)));
    }
    await Promise.all(chunks);
    await db.delete(papers).where(eq(papers.id, paperId));

    return c.json({ ok: true });
});

// PUT /api/papers/:id/description — update paper description
papersRoute.put("/:id/description", authMiddleware, async (c) => {
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

    if (!("description" in body)) {
        return c.json({ error: "description is required" }, 400);
    }
    if (!(typeof body.description === "string" || body.description === null)) {
        return c.json({ error: "description must be a string or null" }, 400);
    }

    const normalizedDescription = typeof body.description === "string"
        ? body.description.split("\0").join("").trim()
        : null;
    if (normalizedDescription && normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
        return c.json({ error: `description must be ${MAX_DESCRIPTION_LENGTH} chars or less` }, 400);
    }

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const paper = await db
        .select({ id: papers.id })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!paper) return c.json({ error: "Not found" }, 404);

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
    if (!author) return c.json({ error: "Forbidden" }, 403);

    const descriptionUpdatedAt = normalizedDescription ? sql`(datetime('now'))` : null;
    await db.update(papers).set({
        description: normalizedDescription,
        descriptionUpdatedAt,
        ...touchUpdatedAt(),
    }).where(eq(papers.id, paperId));

    const updatedPaper = await db
        .select({
            id: papers.id,
            description: papers.description,
            descriptionUpdatedAt: papers.descriptionUpdatedAt,
        })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!updatedPaper) return c.json({ error: "Not found" }, 404);

    const normalizedDescriptionUpdatedAt = toIsoUtc(updatedPaper.descriptionUpdatedAt);

    return c.json({
        id: updatedPaper.id,
        description: updatedPaper.description,
        descriptionUpdatedAt: normalizedDescriptionUpdatedAt,
        // Backward compatibility for existing clients expecting snake_case.
        description_updated_at: normalizedDescriptionUpdatedAt,
    });
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
        if (body.venueType && !(VALID_VENUE_TYPES as readonly string[]).includes(body.venueType)) return c.json({ error: "Invalid venueType" }, 400);
        updates.venueType = body.venueType || null;
        hasRealUpdates = true;
    }
    if ("year" in body) {
        if (!(typeof body.year === "number" || body.year === null) || Number.isNaN(body.year)) {
            return c.json({ error: "year must be a number or null" }, 400);
        }
        updates.year = body.year;
        hasRealUpdates = true;
    }
    if ("category" in body) {
        if (!(typeof body.category === "string" || body.category === null)) {
            return c.json({ error: "category must be a string or null" }, 400);
        }
        if (body.category && !(VALID_CATEGORIES as readonly string[]).includes(body.category)) return c.json({ error: "Invalid category" }, 400);
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
