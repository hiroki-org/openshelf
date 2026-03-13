import { Hono, type Context } from "hono";
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
const VALID_VISIBILITY = ["public", "org_only", "private"] as const;
type VisibilityType = (typeof VALID_VISIBILITY)[number];

const MAX_TITLE_LENGTH = 300;
const MAX_ABSTRACT_LENGTH = 10000;
const MAX_LANGUAGE_LENGTH = 64;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const MAX_DOI_LENGTH = 255;
const MAX_VENUE_LENGTH = 300;
const MAX_ORG_ID_LENGTH = 64;
const MAX_TAG_LENGTH = 64;
const MAX_TAG_COUNT = 50;

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

function hasOwn(source: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(source, key);
}

function parseNullableString(
    value: unknown,
    field: string,
    maxLength: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
    if (value === null || value === undefined) {
        return { ok: true, value: null };
    }
    if (typeof value !== "string") {
        return { ok: false, error: `${field} must be a string or null` };
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
        return { ok: true, value: null };
    }
    if (normalized.length > maxLength) {
        return {
            ok: false,
            error: `${field} must be at most ${maxLength} chars`,
        };
    }
    return { ok: true, value: normalized };
}

function parseTags(
    value: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
    if (value === null || value === undefined) {
        return { ok: true, value: null };
    }
    if (!Array.isArray(value)) {
        return { ok: false, error: "tags must be an array or null" };
    }
    if (value.some((tag) => typeof tag !== "string")) {
        return { ok: false, error: "tags must be an array of strings" };
    }

    const normalized = value
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    if (normalized.length > MAX_TAG_COUNT) {
        return { ok: false, error: `tags must be at most ${MAX_TAG_COUNT} items` };
    }
    if (normalized.some((tag) => tag.length > MAX_TAG_LENGTH)) {
        return { ok: false, error: `each tag must be at most ${MAX_TAG_LENGTH} chars` };
    }

    return {
        ok: true,
        value: normalized.length > 0 ? JSON.stringify(normalized) : null,
    };
}

type ParsedPaperMetadata = {
    title?: string;
    abstract?: string | null;
    visibility?: VisibilityType;
    language?: string | null;
    externalUrl?: string | null;
    doi?: string | null;
    venue?: string | null;
    venueType?: VenueType | null;
    year?: number | null;
    category?: CategoryType | null;
    tags?: string | null;
    orgId?: string | null;
};

function validatePaperMetadata(
    input: Record<string, unknown>,
    mode: "create" | "patch",
): { ok: true; data: ParsedPaperMetadata } | { ok: false; error: string } {
    const isCreate = mode === "create";
    const data: ParsedPaperMetadata = {};

    if (isCreate || hasOwn(input, "title")) {
        if (typeof input.title !== "string") {
            return {
                ok: false,
                error: isCreate
                    ? "title is required (1-300 chars)"
                    : "title must be a string",
            };
        }
        const title = input.title.trim();
        if (!title || title.length > MAX_TITLE_LENGTH) {
            return { ok: false, error: "title is required (1-300 chars)" };
        }
        data.title = title;
    }

    if (isCreate || hasOwn(input, "abstract")) {
        const abstract = parseNullableString(
            isCreate && !hasOwn(input, "abstract") ? null : input.abstract,
            "abstract",
            MAX_ABSTRACT_LENGTH,
        );
        if (!abstract.ok) return abstract;
        data.abstract = abstract.value;
    }

    if (isCreate || hasOwn(input, "visibility")) {
        const rawVisibility = isCreate && !hasOwn(input, "visibility")
            ? "private"
            : input.visibility;
        if (
            typeof rawVisibility !== "string" ||
            !(VALID_VISIBILITY as readonly string[]).includes(rawVisibility)
        ) {
            return { ok: false, error: "Invalid visibility" };
        }
        data.visibility = rawVisibility as VisibilityType;
    }

    if (isCreate || hasOwn(input, "language")) {
        const language = parseNullableString(
            isCreate && !hasOwn(input, "language") ? null : input.language,
            "language",
            MAX_LANGUAGE_LENGTH,
        );
        if (!language.ok) return language;
        data.language = language.value;
    }

    if (isCreate || hasOwn(input, "externalUrl")) {
        const externalUrl = parseNullableString(
            isCreate && !hasOwn(input, "externalUrl") ? null : input.externalUrl,
            "externalUrl",
            MAX_EXTERNAL_URL_LENGTH,
        );
        if (!externalUrl.ok) return externalUrl;
        if (externalUrl.value && !isValidUrlScheme(externalUrl.value)) {
            return {
                ok: false,
                error: "Invalid externalUrl scheme (only http/https allowed)",
            };
        }
        data.externalUrl = externalUrl.value;
    }

    if (isCreate || hasOwn(input, "doi")) {
        const doi = parseNullableString(
            isCreate && !hasOwn(input, "doi") ? null : input.doi,
            "doi",
            MAX_DOI_LENGTH,
        );
        if (!doi.ok) return doi;
        data.doi = doi.value;
    }

    if (isCreate || hasOwn(input, "venue")) {
        const venue = parseNullableString(
            isCreate && !hasOwn(input, "venue") ? null : input.venue,
            "venue",
            MAX_VENUE_LENGTH,
        );
        if (!venue.ok) return venue;
        data.venue = venue.value;
    }

    if (isCreate || hasOwn(input, "venueType")) {
        const rawVenueType = isCreate && !hasOwn(input, "venueType")
            ? null
            : input.venueType;
        if (rawVenueType !== null && rawVenueType !== undefined) {
            if (
                typeof rawVenueType !== "string" ||
                !(VALID_VENUE_TYPES as readonly string[]).includes(rawVenueType)
            ) {
                return { ok: false, error: "Invalid venueType" };
            }
            data.venueType = rawVenueType as VenueType;
        } else {
            data.venueType = null;
        }
    }

    if (isCreate || hasOwn(input, "year")) {
        const rawYear = isCreate && !hasOwn(input, "year") ? null : input.year;
        if (rawYear === null || rawYear === undefined) {
            data.year = null;
        } else if (
            typeof rawYear !== "number" ||
            !Number.isInteger(rawYear) ||
            rawYear < 0 ||
            rawYear > 9999
        ) {
            return { ok: false, error: "year must be an integer between 0 and 9999 or null" };
        } else {
            data.year = rawYear;
        }
    }

    if (isCreate || hasOwn(input, "category")) {
        const rawCategory = isCreate && !hasOwn(input, "category")
            ? null
            : input.category;
        if (rawCategory !== null && rawCategory !== undefined) {
            if (
                typeof rawCategory !== "string" ||
                !(VALID_CATEGORIES as readonly string[]).includes(rawCategory)
            ) {
                return { ok: false, error: "Invalid category" };
            }
            data.category = rawCategory as CategoryType;
        } else {
            data.category = null;
        }
    }

    if (isCreate || hasOwn(input, "tags")) {
        const tags = parseTags(
            isCreate && !hasOwn(input, "tags") ? null : input.tags,
        );
        if (!tags.ok) return tags;
        data.tags = tags.value;
    }

    if (isCreate || hasOwn(input, "orgId")) {
        const orgId = parseNullableString(
            isCreate && !hasOwn(input, "orgId") ? null : input.orgId,
            "orgId",
            MAX_ORG_ID_LENGTH,
        );
        if (!orgId.ok) return orgId;
        data.orgId = orgId.value;
    }

    if (isCreate && data.visibility === "org_only" && !data.orgId) {
        return { ok: false, error: "orgId is required for org_only visibility" };
    }

    return { ok: true, data };
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

    const metadataStr = body["metadata"];
    if (typeof metadataStr !== "string")
        return c.json({ error: "metadata field is required" }, 400);

    let meta: Record<string, unknown>;
    try {
        meta = JSON.parse(metadataStr);
    } catch {
        return c.json({ error: "Invalid metadata JSON" }, 400);
    }

    const validatedMeta = validatePaperMetadata(meta, "create");
    if (!validatedMeta.ok) {
        return c.json({ error: validatedMeta.error }, 400);
    }
    const normalized = validatedMeta.data;
    const vis = normalized.visibility;
    if (!vis) {
        return c.json({ error: "Invalid visibility" }, 400);
    }
    const orgId = normalized.orgId ?? null;

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
        title: normalized.title as string,
        abstract: normalized.abstract ?? null,
        visibility: vis,
        language: normalized.language ?? null,
        externalUrl: normalized.externalUrl ?? null,
        doi: normalized.doi ?? null,
        venue: normalized.venue ?? null,
        venueType: normalized.venueType ?? null,
        year: normalized.year ?? null,
        category: normalized.category ?? null,
        tags: normalized.tags ?? null,
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

        await db.insert(papers).values(paperValues);

        await db
            .insert(paperAuthors)
            .values({ paperId, userId, role: "uploader" });

        if (vis === "org_only" && orgId) {
            await db.insert(paperOrgs).values({ paperId, orgId });
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
        await Promise.all(uploadedKeys.map((key) => c.env.BUCKET.delete(key)));
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

    return c.json({
        paper: {
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            visibility: paper.visibility,
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

// PATCH /api/papers/:id — edit paper metadata
papersRoute.patch("/:id", authMiddleware, async (c) => {
    const paperId = c.req.param("id");
    const userId = c.get("user").sub;
    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }
    const validatedBody = validatePaperMetadata(body, "patch");
    if (!validatedBody.ok) {
        return c.json({ error: validatedBody.error }, 400);
    }
    const normalized = validatedBody.data;

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    const currentPaper = await db
        .select({
            id: papers.id,
            visibility: papers.visibility,
        })
        .from(papers)
        .where(eq(papers.id, paperId))
        .get();
    if (!currentPaper) return c.json({ error: "Not found" }, 404);

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

    type PaperUpdateSet = Omit<Partial<typeof papers.$inferInsert>, "updatedAt"> &
        ReturnType<typeof touchUpdatedAt>;
    const updates: PaperUpdateSet = { ...touchUpdatedAt() };

    if ("title" in normalized) {
        updates.title = normalized.title as string;
    }
    if ("abstract" in normalized) {
        updates.abstract = normalized.abstract ?? null;
    }
    if ("visibility" in normalized) {
        updates.visibility = normalized.visibility;
    }
    if ("language" in normalized) {
        updates.language = normalized.language ?? null;
    }
    if ("externalUrl" in normalized) {
        updates.externalUrl = normalized.externalUrl ?? null;
    }
    if ("doi" in normalized) {
        updates.doi = normalized.doi ?? null;
    }
    if ("venue" in normalized) {
        updates.venue = normalized.venue ?? null;
    }
    if ("venueType" in normalized) {
        updates.venueType = normalized.venueType ?? null;
    }
    if ("year" in normalized) {
        updates.year = normalized.year ?? null;
    }
    if ("category" in normalized) {
        updates.category = normalized.category ?? null;
    }
    if ("tags" in normalized) {
        updates.tags = normalized.tags ?? null;
    }

    const paperOrgRows = await db
        .select({ orgId: paperOrgs.orgId })
        .from(paperOrgs)
        .where(eq(paperOrgs.paperId, paperId))
        .all();
    const currentOrgId = paperOrgRows[0]?.orgId ?? null;
    const nextVisibility = (
        updates.visibility ?? currentPaper.visibility
    ) as VisibilityType;
    const hasOrgIdUpdate = "orgId" in normalized;
    let nextOrgId: string | null = currentOrgId;

    if (nextVisibility === "org_only") {
        if (hasOrgIdUpdate) {
            nextOrgId = normalized.orgId ?? null;
        }
        if (!nextOrgId) {
            return c.json({ error: "orgId is required for org_only visibility" }, 400);
        }

        const membership = await db
            .select({ orgId: orgMembers.orgId })
            .from(orgMembers)
            .where(
                and(
                    eq(orgMembers.orgId, nextOrgId),
                    eq(orgMembers.userId, userId),
                ),
            )
            .get();
        if (!membership) {
            return c.json({ error: "Invalid orgId or not a member" }, 403);
        }
    } else {
        nextOrgId = null;
    }

    await db.update(papers).set(updates).where(eq(papers.id, paperId));

    await db.delete(paperOrgs).where(eq(paperOrgs.paperId, paperId));
    if (nextVisibility === "org_only" && nextOrgId) {
        await db.insert(paperOrgs).values({ paperId, orgId: nextOrgId });
    }

    return c.json({ ok: true });
});

export default papersRoute;
