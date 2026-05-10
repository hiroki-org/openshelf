import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

// ─── helpers ────────────────────────────────────────────────────
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

// ─── users ──────────────────────────────────────────────────────
export const users = sqliteTable(
  "users",
  {
    id: id(),
    githubId: text("github_id").notNull(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    email: text("email"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("users_github_id_idx").on(t.githubId)],
);

export const VALID_VENUE_TYPES = [
  "conference",
  "journal",
  "workshop",
  "other",
] as const;
export type VenueType = (typeof VALID_VENUE_TYPES)[number];

export const VALID_CATEGORIES = [
  "thesis_bachelor",
  "thesis_master",
  "report",
  "presentation",
  "other",
] as const;
export type CategoryType = (typeof VALID_CATEGORIES)[number];

// ─── papers ─────────────────────────────────────────────────────
export const papers = sqliteTable(
  "papers",
  {
    id: id(),
    title: text("title").notNull(),
    abstract: text("abstract"),
    description: text("description"),
    descriptionUpdatedAt: text("description_updated_at"),
    visibility: text("visibility", { enum: ["public", "org_only", "private"] })
      .notNull()
      .default("private"),
    showViewCount: integer("show_view_count", { mode: "boolean" })
      .notNull()
      .default(false),
    language: text("language"),
    externalUrl: text("external_url"),
    doi: text("doi"),
    venue: text("venue"),
    venueType: text("venue_type", {
      enum: VALID_VENUE_TYPES,
    }),
    year: integer("year"),
    category: text("category", {
      enum: VALID_CATEGORIES,
    }),
    tags: text("tags"),
    createdAt: createdAt(),
    /** INSERT 時のみ自動設定．UPDATE 時は touchUpdatedAt() を使うこと */
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("papers_visibility_idx").on(t.visibility),
    index("papers_year_idx").on(t.year),
  ],
);

// ─── paper_views ────────────────────────────────────────────────
export const paperViews = sqliteTable(
  "paper_views",
  {
    id: id(),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    viewedAt: text("viewed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    viewerFingerprint: text("viewer_fingerprint").notNull(),
    viewBucket: integer("view_bucket").notNull(),
  },
  (t) => [
    index("paper_views_paper_id_viewed_at_idx").on(t.paperId, t.viewedAt),
    uniqueIndex("paper_views_dedupe_idx").on(
      t.paperId,
      t.viewerFingerprint,
      t.viewBucket,
    ),
  ],
);

// ─── paper_stats_daily ───────────────────────────────────────────
export const paperStatsDaily = sqliteTable(
  "paper_stats_daily",
  {
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    views: integer("views").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),
    previews: integer("previews").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.paperId, t.date] }),
    index("paper_stats_daily_date_idx").on(t.date),
  ],
);

// ─── paper_stats_total ───────────────────────────────────────────
export const paperStatsTotal = sqliteTable("paper_stats_total", {
  paperId: text("paper_id")
    .primaryKey()
    .references(() => papers.id, { onDelete: "cascade" }),
  totalViews: integer("total_views").notNull().default(0),
  totalDownloads: integer("total_downloads").notNull().default(0),
  totalPreviews: integer("total_previews").notNull().default(0),
  lastUpdated: text("last_updated")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── paper_stats_dedup ───────────────────────────────────────────
export const paperStatsDedup = sqliteTable(
  "paper_stats_dedup",
  {
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    event: text("event", { enum: ["view", "download", "preview"] }).notNull(),
    date: text("date").notNull(),
    sessionHash: text("session_hash").notNull(),
    referrer: text("referrer"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("paper_stats_dedup_unique_idx").on(
      t.paperId,
      t.event,
      t.date,
      t.sessionHash,
    ),
    index("paper_stats_dedup_paper_date_idx").on(t.paperId, t.date),
  ],
);

// ─── paper_files ────────────────────────────────────────────────
export const paperFiles = sqliteTable(
  "paper_files",
  {
    id: id(),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    fileType: text("file_type", {
      enum: ["paper", "slides", "poster", "supplementary"],
    }).notNull(),
    filename: text("filename").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mimeType: text("mime_type"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("paper_files_paper_id_idx").on(t.paperId)],
);

// ─── paper_authors ──────────────────────────────────────────────
export const paperAuthors = sqliteTable(
  "paper_authors",
  {
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["uploader", "coauthor"] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.paperId, t.userId] }),
    index("paper_authors_user_id_idx").on(t.userId),
  ],
);

// ─── orgs ───────────────────────────────────────────────────────
export const orgs = sqliteTable(
  "orgs",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("orgs_slug_idx").on(t.slug)],
);

// ─── org_members ────────────────────────────────────────────────
export const orgMembers = sqliteTable(
  "org_members",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

// ─── paper_orgs ─────────────────────────────────────────────────
export const paperOrgs = sqliteTable(
  "paper_orgs",
  {
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.paperId, t.orgId] }),
    index("paper_orgs_org_id_idx").on(t.orgId),
  ],
);

// ─── collections ────────────────────────────────────────────────
export const collections = sqliteTable(
  "collections",
  {
    id: id(),
    ownerType: text("owner_type", { enum: ["user", "org"] }).notNull(),
    ownerId: text("owner_id").notNull(),
    orgSlug: text("org_slug"),

    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    visibility: text("visibility", { enum: ["public", "org_only", "private"] })
      .notNull()
      .default("private"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("collections_owner_slug_idx").on(
      t.ownerType,
      t.ownerId,
      t.slug,
    ),
  ],
);

// ─── collection_papers ──────────────────────────────────────────
export const collectionPapers = sqliteTable(
  "collection_papers",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: text("added_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.paperId] }),
    index("collection_papers_paper_id_idx").on(t.paperId),
  ],
);

// ─── coauthor_invites ───────────────────────────────────────────
export const coauthorInvites = sqliteTable(
  "coauthor_invites",
  {
    id: id(),
    paperId: text("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeId: text("invitee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    inviteeEmail: text("invitee_email"),
    token: text("token"),
    status: text("status", { enum: ["pending", "accepted", "declined"] })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    respondedAt: text("responded_at"),
  },
  (t) => [
    index("coauthor_invites_paper_id_idx").on(t.paperId),
    index("coauthor_invites_invitee_id_idx").on(t.inviteeId),
    uniqueIndex("coauthor_invites_token_idx").on(t.token),
    uniqueIndex("coauthor_invites_paper_invitee_idx")
      .on(t.paperId, t.inviteeId)
      .where(sql`invitee_id IS NOT NULL`),
    uniqueIndex("coauthor_invites_paper_email_idx")
      .on(t.paperId, t.inviteeEmail)
      .where(sql`invitee_email IS NOT NULL`),
  ],
);

// ─── helpers ────────────────────────────────────────────────────
/**
 * SQLite/D1 には ON UPDATE CURRENT_TIMESTAMP がないため，
 * UPDATE クエリ実行時に必ずこのヘルパーで updatedAt をセットすること．
 *
 * 使用例:
 *   await db.update(papers).set({ title: "new", ...touchUpdatedAt() }).where(...)
 */
export const touchUpdatedAt = () => ({
  updatedAt: sql`(datetime('now'))`,
});

/**
 * D1 はデフォルトで FK 制約が無効．
 * DB 接続取得後，クエリ実行前に必ず呼ぶこと．
 *
 * 使用例:
 *   const db = drizzle(env.DB);
 *   await enableForeignKeys(db);
 */
export const enableForeignKeys = async (db: ReturnType<typeof drizzle>) => {
  await db.run(sql`PRAGMA foreign_keys = ON`);
};
