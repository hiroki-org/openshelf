import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
    papers,
    paperFiles,
    paperAuthors,
    paperOrgs,
    VALID_VENUE_TYPES,
    VALID_CATEGORIES,
    type VenueType,
    type CategoryType,
} from "../db/schema";
import { validateMagicNumbers } from "../utils/file";
import type { Env, Variables } from "../types";
import type { Context } from "hono";

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
];
export const VALID_FILE_TYPES = ["paper", "slides", "poster", "supplementary"];
export const VALID_VISIBILITY = ["public", "org_only", "private"];

export function sanitizeFilename(filename: string): string {
    const basename = filename.split(/[\\/]/).pop() ?? "";
    const cleaned = basename
        .replace(/\.{2,}/g, ".")
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 120);
    return cleaned || `file-${crypto.randomUUID()}`;
}

export function isValidUrlScheme(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
}

export function parseAndValidateMetadata(metadataStr: unknown) {
    if (typeof metadataStr !== "string") {
        return { ok: false, error: "metadata field is required", status: 400 };
    }

    let meta: Record<string, unknown>;
    try {
        meta = JSON.parse(metadataStr);
    } catch {
        return { ok: false, error: "Invalid metadata JSON", status: 400 };
    }

    const title = meta.title as string | undefined;
    if (
        !title ||
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > 300
    ) {
        return { ok: false, error: "title is required (1-300 chars)", status: 400 };
    }

    const vis = (meta.visibility as string) || "private";
    if (!VALID_VISIBILITY.includes(vis)) {
        return { ok: false, error: "Invalid visibility", status: 400 };
    }

    const venueType = (meta.venueType as string | null | undefined) ?? null;
    if (venueType !== null && !(VALID_VENUE_TYPES as readonly string[]).includes(venueType)) {
        return { ok: false, error: "Invalid venueType", status: 400 };
    }

    const category = (meta.category as string | null | undefined) ?? null;
    if (category !== null && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
        return { ok: false, error: "Invalid category", status: 400 };
    }

    const externalUrl = (meta.externalUrl as string) || null;
    if (externalUrl && !isValidUrlScheme(externalUrl)) {
        return { ok: false, error: "Invalid externalUrl scheme (only http/https allowed)", status: 400 };
    }

    const orgId = meta.orgId as string | undefined;
    if (vis === "org_only" && !orgId) {
        return { ok: false, error: "orgId is required for org_only visibility", status: 400 };
    }

    return {
        ok: true,
        data: {
            title: title.trim(),
            visibility: vis as "public" | "org_only" | "private",
            venueType: venueType as VenueType | null,
            category: category as CategoryType | null,
            externalUrl,
            orgId,
            abstract: (meta.abstract as string) || null,
            language: (meta.language as string) || null,
            doi: (meta.doi as string) || null,
            venue: (meta.venue as string) || null,
            year: meta.year != null && !Number.isNaN(Number(meta.year)) ? Number(meta.year) : null,
            tags: meta.tags ? JSON.stringify(meta.tags) : null,
        },
    };
}

export type UploadEntry = {
    file: File;
    fileType: "paper" | "slides" | "poster" | "supplementary";
    safeFilename: string;
    r2Key: string;
};

export async function parseAndValidateFiles(body: Record<string, unknown>, paperId: string) {
    const uploads: UploadEntry[] = [];

    for (let i = 0; ; i++) {
        const fileCandidate = body[`files_${i}`];
        if (!fileCandidate) break;
        if (typeof fileCandidate === "string" || Array.isArray(fileCandidate)) {
            console.error(`Field files_${i} is not a single file`);
            return { ok: false, error: `Field files_${i} is not a valid file`, status: 400 };
        }

        const file = fileCandidate as File;
        if (!(file instanceof File) && typeof (file as Blob).slice !== "function") {
            console.error(`Field files_${i} is not a valid File/Blob`);
            return { ok: false, error: `Field files_${i} is not a valid file`, status: 400 };
        }

        if (file.size > MAX_FILE_SIZE) {
            return { ok: false, error: `File ${file.name} exceeds 50 MB limit`, status: 400 };
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return {
                ok: false,
                error: `File ${file.name} has unsupported type: ${file.type || "unknown"}`,
                status: 400,
            };
        }

        const isValidContent = await validateMagicNumbers(file, file.type);
        if (!isValidContent) {
            console.error(`Magic number validation failed for file ${file.name} (declared: ${file.type})`);
            return {
                ok: false,
                error: `File ${file.name} does not match expected format for ${file.type}`,
                status: 400,
            };
        }

        const ft = (body[`file_types_${i}`] as string) || "paper";
        if (!VALID_FILE_TYPES.includes(ft)) {
            return { ok: false, error: `Invalid file_type: ${ft}`, status: 400 };
        }

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
        return { ok: false, error: "At least one file is required", status: 400 };
    }

    return { ok: true, uploads };
}

export const MAX_CONCURRENT_UPLOADS = 3;

export async function insertPaperAndFiles(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    db: ReturnType<typeof drizzle>,
    paperId: string,
    userId: string,
    metaData: NonNullable<ReturnType<typeof parseAndValidateMetadata>["data"]>,
    uploads: UploadEntry[]
) {
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

        const paperValues: typeof papers.$inferInsert = {
            id: paperId,
            title: metaData.title,
            abstract: metaData.abstract,
            visibility: metaData.visibility,
            language: metaData.language,
            externalUrl: metaData.externalUrl,
            doi: metaData.doi,
            venue: metaData.venue,
            venueType: metaData.venueType,
            year: metaData.year,
            category: metaData.category,
            tags: metaData.tags,
        };

        // NOTE: D1 does not support transactions. If any insert fails,
        // cleanup in catch block will delete the paper (cascading to related records).
        await db.insert(papers).values(paperValues);

        await db
            .insert(paperAuthors)
            .values({ paperId, userId, role: "uploader" });

        if (metaData.visibility === "org_only" && metaData.orgId) {
            await db.insert(paperOrgs).values({ paperId, orgId: metaData.orgId });
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
            })),
        );

        return { ok: true };
    } catch (error) {
        console.error("Error during paper insertion and file upload, rolling back.", error);
        // Cleanup: best-effort, don't mask original error
        await Promise.allSettled([
            ...uploadedKeys.map((key) => c.env.BUCKET.delete(key)),
            db.delete(papers).where(eq(papers.id, paperId)),
        ]);
        return { ok: false, error: error instanceof Error ? error.message : "Failed to upload or insert", status: 500 };
    }
}
