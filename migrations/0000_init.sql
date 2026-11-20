CREATE TABLE `audit_log` (
	`seq` integer PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`site_id` text,
	`summary` text NOT NULL,
	`payload` text NOT NULL,
	`prev_hash` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_site_idx` ON `audit_log` (`site_id`,`seq`);--> statement-breakpoint
CREATE TABLE `demand_baseline` (
	`site_id` text NOT NULL,
	`blood_group` text NOT NULL,
	`component` text NOT NULL,
	`units_per_day` real NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demand_pk` ON `demand_baseline` (`site_id`,`blood_group`,`component`);--> statement-breakpoint
CREATE TABLE `donations` (
	`id` text PRIMARY KEY NOT NULL,
	`donor_id` text NOT NULL,
	`site_id` text NOT NULL,
	`alert_id` text,
	`at` integer NOT NULL,
	FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `donations_donor_idx` ON `donations` (`donor_id`);--> statement-breakpoint
CREATE TABLE `donor_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`donor_id` text NOT NULL,
	`bank_site_id` text NOT NULL,
	`drive_id` text NOT NULL,
	`drive_needed` integer NOT NULL,
	`request_id` text,
	`blood_group` text NOT NULL,
	`component` text NOT NULL,
	`urgency` text NOT NULL,
	`status` text NOT NULL,
	`distance_km` real NOT NULL,
	`message` text NOT NULL,
	`message_localized` text,
	`language` text NOT NULL,
	`confirmation_code` text,
	`arrival_window` text,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `alerts_donor_idx` ON `donor_alerts` (`donor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `alerts_bank_idx` ON `donor_alerts` (`bank_site_id`,`status`);--> statement-breakpoint
CREATE INDEX `alerts_drive_idx` ON `donor_alerts` (`drive_id`);--> statement-breakpoint
CREATE TABLE `donors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`blood_group` text NOT NULL,
	`area_id` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`consent_alerts` integer NOT NULL,
	`consent_location` integer NOT NULL,
	`consent_eligibility` integer NOT NULL,
	`quiet_hours_start` integer,
	`quiet_hours_end` integer,
	`max_alerts_per_week` integer DEFAULT 2 NOT NULL,
	`last_donation_at` integer,
	`opted_out_at` integer,
	`persona` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `donors_group_idx` ON `donors` (`blood_group`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_pk` ON `rate_limits` (`key`,`window_start`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`blood_group` text NOT NULL,
	`component` text NOT NULL,
	`units_needed` integer NOT NULL,
	`urgency` text NOT NULL,
	`needed_by` integer NOT NULL,
	`ward` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`critical_broadcast_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requests_hospital_idx` ON `requests` (`hospital_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`bank_site_id` text NOT NULL,
	`status` text NOT NULL,
	`units_count` integer NOT NULL,
	`match_type` text NOT NULL,
	`requires_phone_confirm` integer DEFAULT false NOT NULL,
	`phone_confirmed_at` integer,
	`decline_reason` text,
	`eta_minutes` integer NOT NULL,
	`confirm_by` integer NOT NULL,
	`hold_expires_at` integer,
	`requested_at` integer NOT NULL,
	`confirmed_at` integer,
	`reserved_at` integer,
	`picked_up_at` integer,
	`delivered_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reservations_request_idx` ON `reservations` (`request_id`);--> statement-breakpoint
CREATE INDEX `reservations_bank_status_idx` ON `reservations` (`bank_site_id`,`status`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`area_id` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`verified` integer DEFAULT true NOT NULL,
	`last_sync_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `surge_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`area_id` text NOT NULL,
	`epicenter_lat` real NOT NULL,
	`epicenter_lng` real NOT NULL,
	`radius_km` real NOT NULL,
	`multipliers` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`brief` text
);
--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`suggestion_key` text NOT NULL,
	`from_site_id` text NOT NULL,
	`to_site_id` text NOT NULL,
	`blood_group` text NOT NULL,
	`component` text NOT NULL,
	`quantity` integer NOT NULL,
	`status` text NOT NULL,
	`rescued_from_expiry` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`eta_minutes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`from_site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transfers_status_idx` ON `transfers` (`status`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`blood_group` text NOT NULL,
	`component` text NOT NULL,
	`collected_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`reservation_id` text,
	`transfer_id` text,
	`offered_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `units_site_status_idx` ON `units` (`site_id`,`status`);--> statement-breakpoint
CREATE INDEX `units_match_idx` ON `units` (`component`,`blood_group`,`status`);--> statement-breakpoint
CREATE INDEX `units_reservation_idx` ON `units` (`reservation_id`);