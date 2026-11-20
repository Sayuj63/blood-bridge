CREATE TABLE `conversations` (
	`channel` text NOT NULL,
	`address` text NOT NULL,
	`step` text DEFAULT 'idle' NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`suppressed_at` integer,
	`last_inbound_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_pk` ON `conversations` (`channel`,`address`);--> statement-breakpoint
CREATE TABLE `gateway_channels` (
	`gateway_id` text NOT NULL,
	`channel` text NOT NULL,
	`adapter` text NOT NULL,
	`state` text NOT NULL,
	`detail` text,
	`version` text,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gateway_channels_pk` ON `gateway_channels` (`gateway_id`,`channel`);--> statement-breakpoint
CREATE TABLE `inbound_messages` (
	`channel` text NOT NULL,
	`message_id` text NOT NULL,
	`intent` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbound_messages_pk` ON `inbound_messages` (`channel`,`message_id`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`to_address` text NOT NULL,
	`body` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`alert_id` text,
	`donor_id` text,
	`fallback_of` text,
	`last_error` text,
	`lease_token` text,
	`claimed_at` integer,
	`claimed_by` text,
	`next_attempt_at` integer NOT NULL,
	`expires_at` integer,
	`provider_message_id` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_claim_idx` ON `outbox` (`status`,`channel`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `outbox_to_idx` ON `outbox` (`to_address`,`created_at`);--> statement-breakpoint
CREATE INDEX `outbox_alert_idx` ON `outbox` (`alert_id`);--> statement-breakpoint
ALTER TABLE `donors` ADD `contact_channel` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `donors` ADD `contact_address` text;--> statement-breakpoint
ALTER TABLE `donors` ADD `contact_opt_in_at` integer;--> statement-breakpoint
CREATE INDEX `donors_contact_idx` ON `donors` (`contact_address`);