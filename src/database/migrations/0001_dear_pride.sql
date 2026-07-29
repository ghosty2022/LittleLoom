CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`role` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`relationship` text,
	`invitee_name` text,
	`invitee_email` text,
	`invitee_phone` text,
	`used_by` text DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX `idx_invite_family` ON `invite_codes` (`family_id`);--> statement-breakpoint
CREATE INDEX `idx_invite_active` ON `invite_codes` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_invite_role` ON `invite_codes` (`role`);--> statement-breakpoint
CREATE INDEX `idx_invite_family_active` ON `invite_codes` (`family_id`,`is_active`);