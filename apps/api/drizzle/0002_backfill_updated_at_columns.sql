ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
--> statement-breakpoint
UPDATE users SET updated_at = created_at;
--> statement-breakpoint
ALTER TABLE paper_files ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
--> statement-breakpoint
UPDATE paper_files SET updated_at = created_at;
--> statement-breakpoint
ALTER TABLE orgs ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
--> statement-breakpoint
UPDATE orgs SET updated_at = created_at;
--> statement-breakpoint
ALTER TABLE coauthor_invites ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
--> statement-breakpoint
UPDATE coauthor_invites SET updated_at = created_at;
