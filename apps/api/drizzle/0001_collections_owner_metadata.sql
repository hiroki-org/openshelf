ALTER TABLE collections ADD COLUMN org_slug TEXT;
--> statement-breakpoint
ALTER TABLE collections ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
--> statement-breakpoint
ALTER TABLE collection_papers ADD COLUMN added_at TEXT NOT NULL DEFAULT (datetime('now'));
