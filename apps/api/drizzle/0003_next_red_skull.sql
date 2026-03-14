CREATE TABLE `paper_views` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`viewed_at` text DEFAULT (datetime('now')) NOT NULL,
	`viewer_fingerprint` text NOT NULL,
	`view_bucket` integer NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_views_paper_id_viewed_at_idx` ON `paper_views` (`paper_id`,`viewed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `paper_views_dedupe_idx` ON `paper_views` (`paper_id`,`viewer_fingerprint`,`view_bucket`);--> statement-breakpoint
ALTER TABLE `papers` ADD `show_view_count` integer DEFAULT false NOT NULL;--> statement-breakpoint
