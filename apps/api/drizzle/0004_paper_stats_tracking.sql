CREATE TABLE `paper_stats_daily` (
`paper_id` text NOT NULL,
`date` text NOT NULL,
`views` integer DEFAULT 0 NOT NULL,
`downloads` integer DEFAULT 0 NOT NULL,
`previews` integer DEFAULT 0 NOT NULL,
PRIMARY KEY(`paper_id`, `date`),
FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_stats_daily_date_idx` ON `paper_stats_daily` (`date`);
--> statement-breakpoint
CREATE TABLE `paper_stats_total` (
`paper_id` text PRIMARY KEY NOT NULL,
`total_views` integer DEFAULT 0 NOT NULL,
`total_downloads` integer DEFAULT 0 NOT NULL,
`total_previews` integer DEFAULT 0 NOT NULL,
`last_updated` text DEFAULT (datetime('now')) NOT NULL,
FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `paper_stats_dedup` (
`paper_id` text NOT NULL,
`event` text NOT NULL,
`date` text NOT NULL,
`session_hash` text NOT NULL,
`referrer` text,
`created_at` text DEFAULT (datetime('now')) NOT NULL,
FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paper_stats_dedup_unique_idx` ON `paper_stats_dedup` (`paper_id`,`event`,`date`,`session_hash`);
--> statement-breakpoint
CREATE INDEX `paper_stats_dedup_paper_date_idx` ON `paper_stats_dedup` (`paper_id`,`date`);
