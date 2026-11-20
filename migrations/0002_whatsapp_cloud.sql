ALTER TABLE `donors` ADD `whatsapp_join_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `donors_whatsapp_join_code_idx` ON `donors` (`whatsapp_join_code`);--> statement-breakpoint
ALTER TABLE `outbox` ADD `template_sent_at` integer;--> statement-breakpoint
ALTER TABLE `outbox` ADD `delivery_status` text;--> statement-breakpoint
CREATE INDEX `outbox_provider_msg_idx` ON `outbox` (`provider_message_id`);