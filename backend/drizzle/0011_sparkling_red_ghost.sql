CREATE INDEX IF NOT EXISTS "air_quality_data_location_timestamp_idx" ON "air_quality_data" ("location","timestamp");--> statement-breakpoint
ALTER TABLE "air_quality_data" ADD CONSTRAINT "air_quality_data_user_id_location_timestamp_unique" UNIQUE("user_id","location","timestamp");--> statement-breakpoint
ALTER TABLE "geomagnetic_data" ADD CONSTRAINT "geomagnetic_data_user_id_timestamp_unique" UNIQUE("user_id","timestamp");--> statement-breakpoint
ALTER TABLE "pollen_data" ADD CONSTRAINT "pollen_data_user_id_location_timestamp_unique" UNIQUE("user_id","location","timestamp");--> statement-breakpoint
ALTER TABLE "pressure_derivatives" ADD CONSTRAINT "pressure_derivatives_user_id_location_timestamp_unique" UNIQUE("user_id","location","timestamp");--> statement-breakpoint
ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_user_id_location_timestamp_unique" UNIQUE("user_id","location","timestamp");