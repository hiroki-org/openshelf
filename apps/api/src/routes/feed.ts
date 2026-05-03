import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono, type Context } from "hono";
import {
    collectionPapers,
    collections,
    orgs,
    paperAuthors,
    paperFiles,
    paperOrgs,
    papers,
    users,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { parseStoredTags } from "../utils/tags";

const feedRoute = new Hono<{ Bindings: Env; Variables: Variables }>();
const FEED_LIMIT = 50;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const PAPER_FEED_SELECT = {
    id: papers.id,
    title: papers.title,
    abstract: papers.abstract,
    category: papers.category,
    tags: papers.tags,
    createdAt: papers.createdAt,
    updatedAt: papers.updatedAt,
} as const;

type FeedContext = Context<{ Bindings: Env; Variables: Variables }>;

type FeedMeta = {
    title: string;
    link: string;
    selfLink: string;
    id: string;
    updated: string;
    authorName: string;
};

type FeedEntry = {
    title: string;
    link: string;
    id: string;
    published: string;
    updated: string;
    summary: string;
    authors: string[];
    category?: string | null;
    enclosure?: {
        href: string;
        type: string;
        length: number;
    };
};

type PaperRow = {
    id: string;
    title: string;
    abstract: string | null;
    category: string | null;
    tags?: string | null;
    createdAt: string;
    updatedAt: string;
};

type AuthorRow = {
    paperId: string;
    role: string;
    name: string;
    displayName: string | null;
};

type FileRow = {
    paperId: string;
    id: string;
    filename: string;
    sizeBytes: number;
    mimeType: string | null;
};

function normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/, "");
}

function escapeXml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function toIsoString(dateStr: string): string {
    const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(dateStr)
        ? dateStr
        : `${dateStr.replace(" ", "T")}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid database datetime: ${dateStr}`);
    }
    return date.toISOString();
}

function latestTimestamp(rows: Array<{ updatedAt: string }>, fallback: string): string {
    if (rows.length === 0) {
        return fallback;
    }

    // Database timestamps should already be ISO-like or parseable directly via string comparison.
    let latest = fallback;

    for (const row of rows) {
        if (row.updatedAt > latest) {
            latest = row.updatedAt;
        }
    }
    return latest;
}

function groupByPaperId<T extends { paperId: string }>(rows: T[]): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const existing = groups.get(row.paperId);
        if (existing) {
            existing.push(row);
        } else {
            groups.set(row.paperId, [row]);
        }
    }
    return groups;
}

function dedupePaperRows(rows: PaperRow[]): PaperRow[] {
    const seen = new Set<string>();
    const uniqueRows: PaperRow[] = [];
    for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        uniqueRows.push(row);
    }
    return uniqueRows;
}

function normalizeTagFilter(value: string | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildTagFilterCondition(tagFilter: string | null) {
    if (!tagFilter) return undefined;

    const normalizedTag = tagFilter.toLowerCase();
    return sql<boolean>`EXISTS (
        SELECT 1
        FROM json_each(COALESCE(${papers.tags}, '[]'))
        WHERE lower(trim(value)) = ${normalizedTag}
    )`;
}

function filterPaperRowsByTag(rows: PaperRow[], tag: string | null): PaperRow[] {
    const uniqueRows = dedupePaperRows(rows);
    if (!tag) return uniqueRows;

    const normalizedTag = tag.toLowerCase();
    return uniqueRows.filter((paper) =>
        parseStoredTags(paper.tags ?? null).some(
            (storedTag) => storedTag.toLowerCase() === normalizedTag,
        ),
    );
}

function authorLabel(author: AuthorRow): string {
    return author.displayName?.trim() || author.name;
}

function sortAuthors(authors: AuthorRow[]): AuthorRow[] {
    return [...authors].sort((a, b) => {
        if (a.role !== b.role) {
            return a.role === "uploader" ? -1 : 1;
        }
        return authorLabel(a).localeCompare(authorLabel(b));
    });
}

function buildAtomFeed(meta: FeedMeta, entries: FeedEntry[]): string {
    const lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        `  <title>${escapeXml(meta.title)}</title>`,
        `  <link href="${escapeXml(meta.link)}" rel="alternate" type="text/html"/>`,
        `  <link href="${escapeXml(meta.selfLink)}" rel="self" type="application/atom+xml"/>`,
        `  <id>${escapeXml(meta.id)}</id>`,
        `  <updated>${escapeXml(meta.updated)}</updated>`,
        `  <author><name>${escapeXml(meta.authorName)}</name></author>`,
    ];

    for (const entry of entries) {
        lines.push("  <entry>");
        lines.push(`    <title>${escapeXml(entry.title)}</title>`);
        lines.push(`    <link href="${escapeXml(entry.link)}"/>`);
        lines.push(`    <id>${escapeXml(entry.id)}</id>`);
        lines.push(`    <published>${escapeXml(entry.published)}</published>`);
        lines.push(`    <updated>${escapeXml(entry.updated)}</updated>`);
        lines.push(`    <summary>${escapeXml(entry.summary)}</summary>`);
        if (entry.authors.length > 0) {
            lines.push(
                entry.authors
                    .map((author) => `    <author><name>${escapeXml(author)}</name></author>`)
                    .join("\n")
            );
        }
        if (entry.category) {
            lines.push(`    <category term="${escapeXml(entry.category)}"/>`);
        }
        if (entry.enclosure) {
            lines.push(
                `    <link rel="enclosure" href="${escapeXml(entry.enclosure.href)}" type="${escapeXml(entry.enclosure.type)}" length="${entry.enclosure.length}"/>`,
            );
        }
        lines.push("  </entry>");
    }

    lines.push("</feed>");
    return lines.join("\n");
}

async function loadPaperAuthors(
    db: ReturnType<typeof drizzle>,
    paperIds: string[],
): Promise<Map<string, AuthorRow[]>> {
    if (paperIds.length === 0) return new Map();

    const rows = await db
        .select({
            paperId: paperAuthors.paperId,
            role: paperAuthors.role,
            name: users.name,
            displayName: users.displayName,
        })
        .from(paperAuthors)
        .innerJoin(users, eq(paperAuthors.userId, users.id))
        .where(inArray(paperAuthors.paperId, paperIds))
        .all();

    const grouped = groupByPaperId(rows);
    const authorsByPaperId = new Map<string, AuthorRow[]>();
    for (const [paperId, authors] of grouped.entries()) {
        authorsByPaperId.set(paperId, sortAuthors(authors));
    }
    return authorsByPaperId;
}

async function loadPaperFiles(
    db: ReturnType<typeof drizzle>,
    paperIds: string[],
): Promise<Map<string, FileRow[]>> {
    if (paperIds.length === 0) return new Map();

    const rows = await db
        .select({
            paperId: paperFiles.paperId,
            id: paperFiles.id,
            filename: paperFiles.filename,
            sizeBytes: paperFiles.sizeBytes,
            mimeType: paperFiles.mimeType,
        })
        .from(paperFiles)
        .where(and(eq(paperFiles.fileType, "paper"), inArray(paperFiles.paperId, paperIds)))
        .orderBy(desc(paperFiles.createdAt))
        .all();

    return groupByPaperId(rows);
}

function buildPaperEntries(
    papersRows: PaperRow[],
    authorsByPaperId: Map<string, AuthorRow[]>,
    filesByPaperId: Map<string, FileRow[]>,
    frontendBaseUrl: string,
    apiBaseUrl: string,
    fallbackAuthorName: string,
): FeedEntry[] {
    const frontendBase = normalizeBaseUrl(frontendBaseUrl);
    const apiBase = normalizeBaseUrl(apiBaseUrl);
    const fallback = fallbackAuthorName.trim() || "OpenShelf";
    const fallbackArray = [fallback];

    const len = papersRows.length;
    const entries: FeedEntry[] = new Array(len);

    for (let i = 0; i < len; i++) {
        const paper = papersRows[i];
        const paperId = paper.id;

        const authorsRow = authorsByPaperId.get(paperId);
        let entryAuthors;
        if (authorsRow !== undefined && authorsRow.length > 0) {
            const authorsLen = authorsRow.length;
            entryAuthors = new Array(authorsLen);
            for (let j = 0; j < authorsLen; j++) {
                entryAuthors[j] = authorLabel(authorsRow[j]);
            }
        } else {
            entryAuthors = fallbackArray;
        }

        const filesRow = filesByPaperId.get(paperId);
        const enclosure = filesRow !== undefined && filesRow.length > 0 ? filesRow[0] : undefined;

        entries[i] = {
            title: paper.title,
            link: `${frontendBase}/papers/${encodeURIComponent(paperId)}`,
            id: `urn:openshelf:paper:${paperId}`,
            published: toIsoString(paper.createdAt),
            updated: toIsoString(paper.updatedAt),
            summary: paper.abstract ?? "",
            authors: entryAuthors,
            category: paper.category ?? undefined,
            enclosure: enclosure
                ? {
                      href: `${apiBase}/api/papers/${encodeURIComponent(paperId)}/files/${encodeURIComponent(enclosure.id)}/stream`,
                      type: enclosure.mimeType ?? "application/pdf",
                      length: enclosure.sizeBytes,
                  }
                : undefined,
        };
    }

    return entries;
}

async function buildFeedResponse(
    c: FeedContext,
    meta: Omit<FeedMeta, "updated"> & { updatedFallback: string },
    papersRows: PaperRow[],
): Promise<Response> {
    const db = drizzle(c.env.DB);
    const paperIds = papersRows.map((paper) => paper.id);
    const [authorsByPaperId, filesByPaperId] = await Promise.all([
        loadPaperAuthors(db, paperIds),
        loadPaperFiles(db, paperIds),
    ]);
    const entries = buildPaperEntries(
        papersRows,
        authorsByPaperId,
        filesByPaperId,
        c.env.FRONTEND_URL,
        new URL(c.req.url).origin,
        meta.authorName,
    );
    const xml = buildAtomFeed(
        {
            title: meta.title,
            link: meta.link,
            selfLink: meta.selfLink,
            id: meta.id,
            updated: toIsoString(latestTimestamp(papersRows, meta.updatedFallback)),
            authorName: meta.authorName,
        },
        entries,
    );

    return new Response(xml, {
        headers: {
            "Content-Type": "application/atom+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
        },
    });
}

async function buildOrgFeedResponse(c: FeedContext, slug: string): Promise<Response> {
    if (!SLUG_REGEX.test(slug)) {
        return c.json({ error: "invalid slug" }, 400);
    }
    const db = drizzle(c.env.DB);
    const tagFilter = normalizeTagFilter(c.req.query("tag") ?? undefined);
    const tagCondition = buildTagFilterCondition(tagFilter);

    const org = await db.select().from(orgs).where(eq(orgs.slug, slug)).get();
    if (!org) return c.json({ error: "Org not found" }, 404);

    const papersRows = await db
        .select(PAPER_FEED_SELECT)
        .from(paperOrgs)
        .innerJoin(papers, eq(paperOrgs.paperId, papers.id))
        .where(and(eq(paperOrgs.orgId, org.id), eq(papers.visibility, "public"), tagCondition))
        .orderBy(desc(papers.createdAt))
        .limit(FEED_LIMIT)
        .all();

    return await buildFeedResponse(
        c,
        {
            title: `${org.name} - OpenShelf`,
            link: `${normalizeBaseUrl(c.env.FRONTEND_URL)}/orgs/${encodeURIComponent(slug)}`,
            selfLink: c.req.url,
            id: `urn:openshelf:org:${slug}`,
            updatedFallback: org.updatedAt,
            authorName: org.name,
        },
        // SQLで絞り込み済みだが、フィルタの整合性確認と重複排除を兼ねて再利用する
        filterPaperRowsByTag(papersRows, tagFilter),
    );
}

async function buildUserFeedResponse(c: FeedContext, id: string): Promise<Response> {
    const db = drizzle(c.env.DB);
    const tagFilter = normalizeTagFilter(c.req.query("tag") ?? undefined);
    const tagCondition = buildTagFilterCondition(tagFilter);

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) return c.json({ error: "User not found" }, 404);
    const authorName = (user.displayName ?? user.name ?? "").trim() || "OpenShelf";

    const papersRows = await db
        .select(PAPER_FEED_SELECT)
        .from(paperAuthors)
        .innerJoin(papers, eq(paperAuthors.paperId, papers.id))
        .where(and(eq(paperAuthors.userId, id), eq(papers.visibility, "public"), tagCondition))
        .orderBy(desc(papers.createdAt))
        .limit(FEED_LIMIT)
        .all();

    return await buildFeedResponse(
        c,
        {
            title: `${authorName} - OpenShelf`,
            link: `${normalizeBaseUrl(c.env.FRONTEND_URL)}/users/${encodeURIComponent(id)}`,
            selfLink: c.req.url,
            id: `urn:openshelf:user:${id}`,
            updatedFallback: user.updatedAt,
            authorName,
        },
        // SQLで絞り込み済みだが、フィルタの整合性確認と重複排除を兼ねて再利用する
        filterPaperRowsByTag(papersRows, tagFilter),
    );
}

async function buildOrgCollectionFeedResponse(
    c: FeedContext,
    slug: string,
    collectionSlug: string,
): Promise<Response> {
    if (!SLUG_REGEX.test(slug) || !SLUG_REGEX.test(collectionSlug)) {
        return c.json({ error: "invalid slug" }, 400);
    }
    const db = drizzle(c.env.DB);

    const org = await db.select().from(orgs).where(eq(orgs.slug, slug)).get();
    if (!org) return c.json({ error: "Org not found" }, 404);

    const collection = await db
        .select()
        .from(collections)
        .where(
            and(
                eq(collections.ownerType, "org"),
                eq(collections.ownerId, org.id),
                eq(collections.slug, collectionSlug),
            ),
        )
        .get();

    if (!collection || collection.visibility !== "public") {
        return c.json({ error: "Collection not found" }, 404);
    }

    const papersRows = await db
        .select(PAPER_FEED_SELECT)
        .from(collectionPapers)
        .innerJoin(papers, eq(collectionPapers.paperId, papers.id))
        .where(and(eq(collectionPapers.collectionId, collection.id), eq(papers.visibility, "public")))
        .orderBy(asc(collectionPapers.sortOrder))
        .limit(FEED_LIMIT)
        .all();

    return await buildFeedResponse(
        c,
        {
            title: `${collection.name} - ${org.name} - OpenShelf`,
            link: `${normalizeBaseUrl(c.env.FRONTEND_URL)}/orgs/${encodeURIComponent(slug)}/c/${encodeURIComponent(collectionSlug)}`,
            selfLink: c.req.url,
            id: `urn:openshelf:collection:${collection.id}`,
            updatedFallback: collection.updatedAt,
            authorName: org.name,
        },
        dedupePaperRows(papersRows),
    );
}

async function buildUserCollectionFeedResponse(
    c: FeedContext,
    id: string,
    collectionSlug: string,
): Promise<Response> {
    if (!SLUG_REGEX.test(collectionSlug)) {
        return c.json({ error: "invalid slug" }, 400);
    }

    const db = drizzle(c.env.DB);

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) return c.json({ error: "User not found" }, 404);
    const authorName = (user.displayName ?? user.name ?? "").trim() || "OpenShelf";

    const collection = await db
        .select()
        .from(collections)
        .where(
            and(
                eq(collections.ownerType, "user"),
                eq(collections.ownerId, id),
                eq(collections.slug, collectionSlug),
            ),
        )
        .get();

    if (!collection || collection.visibility !== "public") {
        return c.json({ error: "Collection not found" }, 404);
    }

    const papersRows = await db
        .select(PAPER_FEED_SELECT)
        .from(collectionPapers)
        .innerJoin(papers, eq(collectionPapers.paperId, papers.id))
        .where(and(eq(collectionPapers.collectionId, collection.id), eq(papers.visibility, "public")))
        .orderBy(asc(collectionPapers.sortOrder))
        .limit(FEED_LIMIT)
        .all();

    return await buildFeedResponse(
        c,
        {
            title: `${collection.name} - ${authorName} - OpenShelf`,
            link: `${normalizeBaseUrl(c.env.FRONTEND_URL)}/users/${encodeURIComponent(id)}/c/${encodeURIComponent(collectionSlug)}`,
            selfLink: c.req.url,
            id: `urn:openshelf:collection:${collection.id}`,
            updatedFallback: collection.updatedAt,
            authorName,
        },
        dedupePaperRows(papersRows),
    );
}

feedRoute.get("/orgs/:slug/atom.xml", async (c) => buildOrgFeedResponse(c, c.req.param("slug")));
feedRoute.get("/org/:slug", async (c) => buildOrgFeedResponse(c, c.req.param("slug")));

feedRoute.get("/users/:id/atom.xml", async (c) => buildUserFeedResponse(c, c.req.param("id")));
feedRoute.get("/user/:id", async (c) => buildUserFeedResponse(c, c.req.param("id")));

feedRoute.get("/orgs/:slug/collections/:cSlug/atom.xml", async (c) =>
    buildOrgCollectionFeedResponse(c, c.req.param("slug"), c.req.param("cSlug")),
);
feedRoute.get("/org/:slug/collection/:collectionSlug", async (c) =>
    buildOrgCollectionFeedResponse(c, c.req.param("slug"), c.req.param("collectionSlug")),
);

feedRoute.get("/users/:id/collections/:cSlug/atom.xml", async (c) =>
    buildUserCollectionFeedResponse(c, c.req.param("id"), c.req.param("cSlug")),
);
feedRoute.get("/user/:id/collection/:collectionSlug", async (c) =>
    buildUserCollectionFeedResponse(c, c.req.param("id"), c.req.param("collectionSlug")),
);

export default feedRoute;
