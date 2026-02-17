CREATE TABLE IF NOT EXISTS "pollen_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"tree_index" integer NOT NULL,
	"grass_index" integer NOT NULL,
	"weed_index" integer NOT NULL,
	"mold_index" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pollen_data_user_id_timestamp_idx" ON "pollen_data" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pollen_data_location_timestamp_idx" ON "pollen_data" ("location","timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pollen_data" ADD CONSTRAINT "pollen_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
