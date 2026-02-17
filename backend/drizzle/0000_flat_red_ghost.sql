CREATE TABLE IF NOT EXISTS "air_quality_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"pm25" numeric(6, 2) NOT NULL,
	"pm10" numeric(6, 2) NOT NULL,
	"ozone" numeric(6, 2) NOT NULL,
	"no2" numeric(6, 2) NOT NULL,
	"so2" numeric(6, 2) NOT NULL,
	"co" numeric(8, 2) NOT NULL,
	"us_aqi" numeric(5, 2) NOT NULL,
	"european_aqi" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"condition_value" numeric(8, 3) NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geomagnetic_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timestamp" timestamp NOT NULL,
	"kp_index" numeric(4, 2) NOT NULL,
	"kp_estimated" numeric(4, 2) NOT NULL,
	"solar_wind_speed" numeric(6, 2) NOT NULL,
	"solar_wind_density" numeric(7, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pressure_derivatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"delta_1h" numeric(6, 3) NOT NULL,
	"delta_3h" numeric(6, 3) NOT NULL,
	"delta_6h" numeric(6, 3) NOT NULL,
	"trend" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensor_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timestamp" timestamp NOT NULL,
	"pressure" numeric(6, 2) NOT NULL,
	"temperature" numeric(5, 2) NOT NULL,
	"humidity" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "symptom_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timestamp" timestamp NOT NULL,
	"severity" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"condition" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"location" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weather_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"pressure" numeric(6, 2) NOT NULL,
	"temperature" numeric(5, 2) NOT NULL,
	"humidity" numeric(5, 2) NOT NULL,
	"wind_speed" numeric(5, 2) NOT NULL,
	"wind_direction" numeric(5, 2) NOT NULL,
	"uv_index" numeric(4, 2) NOT NULL,
	"cloud_cover" numeric(5, 2) NOT NULL,
	"precipitation" numeric(6, 2) NOT NULL,
	"dew_point" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "air_quality_data_user_id_timestamp_idx" ON "air_quality_data" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_history_user_id_triggered_at_idx" ON "alert_history" ("user_id","triggered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geomagnetic_data_user_id_timestamp_idx" ON "geomagnetic_data" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pressure_derivatives_user_id_timestamp_idx" ON "pressure_derivatives" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensor_readings_user_id_timestamp_idx" ON "sensor_readings" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptom_logs_user_id_timestamp_idx" ON "symptom_logs" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weather_data_user_id_timestamp_idx" ON "weather_data" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weather_data_location_timestamp_idx" ON "weather_data" ("location","timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "air_quality_data" ADD CONSTRAINT "air_quality_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_rule_id_user_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "user_alert_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "geomagnetic_data" ADD CONSTRAINT "geomagnetic_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pressure_derivatives" ADD CONSTRAINT "pressure_derivatives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "symptom_logs" ADD CONSTRAINT "symptom_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_alert_rules" ADD CONSTRAINT "user_alert_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
