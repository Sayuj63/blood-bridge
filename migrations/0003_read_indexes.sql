CREATE INDEX `audit_action_idx` ON `audit_log` (`action`,`seq`);--> statement-breakpoint
CREATE INDEX `units_status_expiry_idx` ON `units` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `units_site_status_expiry_idx` ON `units` (`site_id`,`status`,`expires_at`);