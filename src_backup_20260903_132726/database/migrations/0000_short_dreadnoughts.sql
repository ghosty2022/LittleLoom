CREATE TABLE `album_photos` (
	`album_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `smart_albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_album_photos_pk` ON `album_photos` (`album_id`,`photo_id`);--> statement-breakpoint
CREATE INDEX `idx_album_photos_photo` ON `album_photos` (`photo_id`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `babies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`date_of_birth` text NOT NULL,
	`gender` text,
	`blood_type` text,
	`allergies` text DEFAULT '[]',
	`medical_notes` text,
	`parent1_id` text,
	`parent2_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_babies_active` ON `babies` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_babies_parent` ON `babies` (`parent1_id`);--> statement-breakpoint
CREATE INDEX `idx_babies_sync` ON `babies` (`sync_status`);--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`avatar` text,
	`role` text NOT NULL,
	`relationship` text NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`added_by` text NOT NULL,
	`can_be_removed` integer DEFAULT true NOT NULL,
	`last_active` text,
	`phone_number` text,
	`notifications_enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_family_baby` ON `family_members` (`baby_id`);--> statement-breakpoint
CREATE INDEX `idx_family_email` ON `family_members` (`email`);--> statement-breakpoint
CREATE INDEX `idx_family_role` ON `family_members` (`role`);--> statement-breakpoint
CREATE INDEX `idx_family_status` ON `family_members` (`status`);--> statement-breakpoint
CREATE INDEX `idx_family_baby_role` ON `family_members` (`baby_id`,`role`);--> statement-breakpoint
CREATE TABLE `photo_import_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`uri` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`source_type` text NOT NULL,
	`detected_baby_ids` text DEFAULT '[]',
	`ai_confidence` real,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_import_queue_uri_unique` ON `photo_import_queue` (`uri`);--> statement-breakpoint
CREATE INDEX `idx_queue_status` ON `photo_import_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_queue_priority` ON `photo_import_queue` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`uri` text NOT NULL,
	`local_uri` text,
	`thumbnail_uri` text,
	`baby_id` text,
	`date` text NOT NULL,
	`timestamp` integer NOT NULL,
	`type` text DEFAULT 'daily' NOT NULL,
	`caption` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`is_screenshot` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '[]',
	`location` text,
	`exif` text,
	`mood` text,
	`source` text DEFAULT 'camera' NOT NULL,
	`backup_status` text DEFAULT 'pending' NOT NULL,
	`faces_detected` text DEFAULT '[]',
	`ai_tags` text DEFAULT '[]',
	`blur_hash` text,
	`folder` text,
	`linked_entry_id` text,
	`linked_entry_type` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_uri_unique` ON `photos` (`uri`);--> statement-breakpoint
CREATE INDEX `idx_photos_baby` ON `photos` (`baby_id`);--> statement-breakpoint
CREATE INDEX `idx_photos_date` ON `photos` (`date`);--> statement-breakpoint
CREATE INDEX `idx_photos_timestamp` ON `photos` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_photos_type` ON `photos` (`type`);--> statement-breakpoint
CREATE INDEX `idx_photos_favorite` ON `photos` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_photos_private` ON `photos` (`is_private`);--> statement-breakpoint
CREATE INDEX `idx_photos_source` ON `photos` (`source`);--> statement-breakpoint
CREATE INDEX `idx_photos_backup` ON `photos` (`backup_status`);--> statement-breakpoint
CREATE INDEX `idx_photos_sync` ON `photos` (`sync_status`);--> statement-breakpoint
CREATE INDEX `idx_photos_baby_date` ON `photos` (`baby_id`,`date`);--> statement-breakpoint
CREATE TABLE `scan_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`photos_found` integer DEFAULT 0 NOT NULL,
	`photos_imported` integer DEFAULT 0 NOT NULL,
	`photos_skipped` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE TABLE `smart_albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`icon` text,
	`gradient` text,
	`filter_query` text,
	`photo_count` integer DEFAULT 0 NOT NULL,
	`cover_photo_id` text,
	`is_system` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cover_photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_albums_type` ON `smart_albums` (`type`);--> statement-breakpoint
CREATE INDEX `idx_albums_system` ON `smart_albums` (`is_system`,`sort_order`);--> statement-breakpoint
CREATE TABLE `tracker_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tracker_id` text NOT NULL,
	`baby_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`title` text,
	`data` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`tags` text DEFAULT '[]',
	`photo_uris` text DEFAULT '[]',
	`location` text,
	`mood` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_entries_tracker` ON `tracker_entries` (`tracker_id`);--> statement-breakpoint
CREATE INDEX `idx_entries_baby` ON `tracker_entries` (`baby_id`);--> statement-breakpoint
CREATE INDEX `idx_entries_timestamp` ON `tracker_entries` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_entries_baby_tracker` ON `tracker_entries` (`baby_id`,`tracker_id`);--> statement-breakpoint
CREATE INDEX `idx_entries_sync` ON `tracker_entries` (`sync_status`);