import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  },
  (t) => [uniqueIndex("users_github_id_idx").on(t.githubId)],
);

// ─── papers ─────────────────────────────────────────────────────
export const papers = sqliteTable(
  "papers",
  {
    id: id(),
    title: text("title").notNull(),
    abstract: text("abstract"),
    visibility: text("visibility", { enum: ["public", "org_only", "private"] })
      .notNull()
      .default("private"),
    language: text("language"),
    externalUrl: text("external_url"),
    doi: text("doi"),
    venue: text("venue"),
    venueType: text("venue_type", {
      enum: ["conference", "journal", "workshop", "other"],
    }),
    year: integer("year"),
    category: text("category", {
      enum: ["thesis_bachelor", "thesis_master", "report", "presentation", "other"],
    }),
    tags: text("tags"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("papers_visibility_idx").on(t.visibility),
    index("papers_year_idx").on(t.year),
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
    role: text("role", { enum: ["admin", "member"] })
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
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    visibility: text("visibility", { enum: ["public", "org_only", "private"] })
      .notNull()
      .default("private"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("collections_slug_idx").on(t.slug),
    index("collections_owner_idx").on(t.ownerType, t.ownerId),
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
    status: text("status", { enum: ["pending", "accepted", "declined"] })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
    respondedAt: text("responded_at"),
  },
  (t) => [
    index("coauthor_invites_paper_id_idx").on(t.paperId),
    index("coauthor_invites_invitee_id_idx").on(t.inviteeId),
  ],
);
