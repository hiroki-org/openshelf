ALTER TABLE users ADD COLUMN updated_at TEXT;
--> statement-breakpoint
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
--> statement-breakpoint
ALTER TABLE paper_files ADD COLUMN updated_at TEXT;
--> statement-breakpoint
UPDATE paper_files SET updated_at = created_at WHERE updated_at IS NULL;
--> statement-breakpoint
ALTER TABLE orgs ADD COLUMN updated_at TEXT;
--> statement-breakpoint
UPDATE orgs SET updated_at = created_at WHERE updated_at IS NULL;
--> statement-breakpoint
ALTER TABLE coauthor_invites ADD COLUMN updated_at TEXT;
--> statement-breakpoint
UPDATE coauthor_invites SET updated_at = created_at WHERE updated_at IS NULL;
