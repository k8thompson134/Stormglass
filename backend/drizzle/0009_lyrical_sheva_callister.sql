ALTER TABLE "push_subscriptions" ADD COLUMN "mecfs_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_notified_mecfs_risk" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "pots_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_notified_pots_risk" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "clear_air_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_notified_clear_air_window_start" text;