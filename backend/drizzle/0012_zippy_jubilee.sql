ALTER TABLE "push_subscriptions" ADD COLUMN "sinus_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_notified_sinus_risk" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "cluster_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_notified_cluster_risk" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "fibromyalgia_alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_notified_fibromyalgia_risk" text;