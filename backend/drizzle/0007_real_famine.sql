CREATE TABLE IF NOT EXISTS "push_notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"type" text NOT NULL,
	"outcome" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"event_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_notification_log_subscription_id_created_at_idx" ON "push_notification_log" ("subscription_id","created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_notification_log" ADD CONSTRAINT "push_notification_log_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
