CREATE TABLE `coauthor_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`inviter_id` text NOT NULL,
	`invitee_id` text,
	`invitee_email` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `coauthor_invites_paper_id_idx` ON `coauthor_invites` (`paper_id`);--> statement-breakpoint
CREATE INDEX `coauthor_invites_invitee_id_idx` ON `coauthor_invites` (`invitee_id`);--> statement-breakpoint
CREATE TABLE `collection_papers` (
	`collection_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`collection_id`, `paper_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_papers_paper_id_idx` ON `collection_papers` (`paper_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_idx` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_owner_idx` ON `collections` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `org_members` (
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	PRIMARY KEY(`org_id`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_slug_idx` ON `orgs` (`slug`);--> statement-breakpoint
CREATE TABLE `paper_authors` (
	`paper_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`paper_id`, `user_id`),
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_authors_user_id_idx` ON `paper_authors` (`user_id`);--> statement-breakpoint
CREATE TABLE `paper_files` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_type` text NOT NULL,
	`filename` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime_type` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_files_paper_id_idx` ON `paper_files` (`paper_id`);--> statement-breakpoint
CREATE TABLE `paper_orgs` (
	`paper_id` text NOT NULL,
	`org_id` text NOT NULL,
	PRIMARY KEY(`paper_id`, `org_id`),
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_orgs_org_id_idx` ON `paper_orgs` (`org_id`);--> statement-breakpoint
CREATE TABLE `papers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`abstract` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`language` text,
	`external_url` text,
	`doi` text,
	`venue` text,
	`venue_type` text,
	`year` integer,
	`category` text,
	`tags` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `papers_visibility_idx` ON `papers` (`visibility`);--> statement-breakpoint
CREATE INDEX `papers_year_idx` ON `papers` (`year`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`email` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_idx` ON `users` (`github_id`);