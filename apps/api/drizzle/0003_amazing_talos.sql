CREATE TABLE `paper_views` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`viewer_fingerprint` text NOT NULL,
	`viewed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_views_paper_id_idx` ON `paper_views` (`paper_id`);--> statement-breakpoint
CREATE INDEX `paper_views_fingerprint_idx` ON `paper_views` (`viewer_fingerprint`);--> statement-breakpoint
ALTER TABLE `papers` ADD `show_view_count` integer DEFAULT false NOT NULL;