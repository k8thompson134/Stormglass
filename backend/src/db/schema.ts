import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  location: text("location").notNull(),
  name: text("name"), // display name for `location`, e.g. "Milwaukee, Wisconsin"
  timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Weather data from Open-Meteo API
export const weatherData = pgTable(
  "weather_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    location: text("location").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    pressure: numeric("pressure", { precision: 6, scale: 2 }).notNull(), // hPa
    temperature: numeric("temperature", { precision: 5, scale: 2 }).notNull(), // °C
    humidity: numeric("humidity", { precision: 5, scale: 2 }).notNull(), // %
    windSpeed: numeric("wind_speed", { precision: 5, scale: 2 }).notNull(), // m/s
    windDirection: numeric("wind_direction", {
      precision: 5,
      scale: 2,
    }).notNull(), // degrees
    uvIndex: numeric("uv_index", { precision: 4, scale: 2 }).notNull(),
    cloudCover: numeric("cloud_cover", { precision: 5, scale: 2 }).notNull(), // %
    precipitation: numeric("precipitation", {
      precision: 6,
      scale: 2,
    }).notNull(), // mm
    dewPoint: numeric("dew_point", { precision: 5, scale: 2 }).notNull(), // °C
  },
  (table) => ({
    userIdTimestampIdx: index("weather_data_user_id_timestamp_idx").on(
      table.userId,
      table.timestamp,
    ),
    locationTimestampIdx: index("weather_data_location_timestamp_idx").on(
      table.location,
      table.timestamp,
    ),
  }),
);

// Pre-computed pressure derivatives
export const pressureDerivatives = pgTable(
  "pressure_derivatives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    location: text("location").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    delta1h: numeric("delta_1h", { precision: 6, scale: 3 }).notNull(), // hPa/hour
    delta3h: numeric("delta_3h", { precision: 6, scale: 3 }).notNull(), // hPa/hour
    delta6h: numeric("delta_6h", { precision: 6, scale: 3 }).notNull(), // hPa/hour
    trend: text("trend", { enum: ["rising", "falling", "stable"] }).notNull(),
  },
  (table) => ({
    userIdTimestampIdx: index("pressure_derivatives_user_id_timestamp_idx").on(
      table.userId,
      table.timestamp,
    ),
  }),
);

// Air quality data from Open-Meteo Air Quality API
export const airQualityData = pgTable(
  "air_quality_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    location: text("location").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    pm25: numeric("pm25", { precision: 6, scale: 2 }).notNull(), // µg/m³
    pm10: numeric("pm10", { precision: 6, scale: 2 }).notNull(), // µg/m³
    ozone: numeric("ozone", { precision: 6, scale: 2 }).notNull(), // ppb
    no2: numeric("no2", { precision: 6, scale: 2 }).notNull(), // ppb
    so2: numeric("so2", { precision: 6, scale: 2 }).notNull(), // ppb
    co: numeric("co", { precision: 8, scale: 2 }).notNull(), // ppb
    usAqi: numeric("us_aqi", { precision: 5, scale: 2 }).notNull(),
    europeanAqi: numeric("european_aqi", { precision: 5, scale: 2 }).notNull(),
  },
  (table) => ({
    userIdTimestampIdx: index("air_quality_data_user_id_timestamp_idx").on(
      table.userId,
      table.timestamp,
    ),
  }),
);

// Geomagnetic data from NOAA
export const geomagneticData = pgTable(
  "geomagnetic_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    timestamp: timestamp("timestamp").notNull(),
    kpIndex: numeric("kp_index", { precision: 4, scale: 2 }).notNull(),
    kpEstimated: numeric("kp_estimated", { precision: 4, scale: 2 }).notNull(),
    solarWindSpeed: numeric("solar_wind_speed", {
      precision: 6,
      scale: 2,
    }).notNull(), // km/s
    solarWindDensity: numeric("solar_wind_density", {
      precision: 7,
      scale: 3,
    }).notNull(), // particles/cm³
  },
  (table) => ({
    userIdTimestampIdx: index("geomagnetic_data_user_id_timestamp_idx").on(
      table.userId,
      table.timestamp,
    ),
  }),
);

// Pollen and Mold data from Tomorrow.io
export const pollenData = pgTable(
  "pollen_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    location: text("location").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    treeIndex: integer("tree_index").notNull(), // 0-5
    grassIndex: integer("grass_index").notNull(), // 0-5
    weedIndex: integer("weed_index").notNull(), // 0-5
    moldIndex: integer("mold_index").notNull(), // 0-5
  },
  (table) => ({
    userIdTimestampIdx: index("pollen_data_user_id_timestamp_idx").on(
      table.userId,
      table.timestamp,
    ),
    locationTimestampIdx: index("pollen_data_location_timestamp_idx").on(
      table.location,
      table.timestamp,
    ),
  }),
);

// Symptom logs
export const symptomLogs = pgTable(
  "symptom_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    timestamp: timestamp("timestamp").notNull(),
    severity: integer("severity").notNull(), // 1-10
    tags: jsonb("tags").$type<string[]>().default([]),
    notes: text("notes"),
    environmentalSnapshot: jsonb("environmental_snapshot"),
    syncedAt: timestamp("synced_at"),
  },
  (table) => ({
    userIdTimestampIdx: index("symptom_logs_user_id_timestamp_idx").on(
      table.userId,
      table.timestamp,
    ),
  }),
);

// One row per subscribed browser/device (Web Push). `endpoint` is the unique push
// service URL the browser gives us on subscribe -- naturally unique per device, so
// it doubles as the natural key rather than needing a separate device id.
// `lastNotifiedCategory` is the dedup state for the AQI category-crossing alert: we
// only send again once the forecast's next crossing resolves to a DIFFERENT category
// than the one we last notified this device about, so a re-poll every 30 minutes
// doesn't resend the same "crosses into Unhealthy" alert repeatedly.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  aqiAlertsEnabled: boolean("aqi_alerts_enabled").default(true).notNull(),
  // Dedup for the forecast heads-up ("crosses into X around 4pm").
  lastNotifiedCategory: text("last_notified_category"),
  // Separate dedup for "air quality is bad right now" -- distinct from the forecast
  // heads-up above since it tracks the CURRENT category, not an upcoming crossing,
  // and needs to re-fire independently if the forecast alert already covered the
  // earlier crossing but conditions later worsen further.
  lastNotifiedCurrentBadCategory: text("last_notified_current_bad_category"),
  // Separate opt-in from aqiAlertsEnabled -- migraine risk oscillates far more than
  // AQI category, so bundling it with the main push toggle would surprise people
  // who only wanted AQI alerts with a much noisier notification stream.
  migraineAlertsEnabled: boolean("migraine_alerts_enabled")
    .default(false)
    .notNull(),
  lastNotifiedMigraineRisk: text("last_notified_migraine_risk"),
  // Same separate-opt-in reasoning as migraine above -- each condition-specific
  // alert oscillates on its own schedule, so bundling them would surprise someone
  // who only wanted one.
  mecfsAlertsEnabled: boolean("mecfs_alerts_enabled").default(false).notNull(),
  lastNotifiedMecfsRisk: text("last_notified_mecfs_risk"),
  potsAlertsEnabled: boolean("pots_alerts_enabled").default(false).notNull(),
  lastNotifiedPotsRisk: text("last_notified_pots_risk"),
  // Dedup by window start (not a risk level) -- a clean-air alert isn't "did risk
  // get worse than last time," it's "is this a window we haven't already told this
  // device about." Text (ISO timestamp truncated to the hour), not a risk ordinal.
  clearAirAlertsEnabled: boolean("clear_air_alerts_enabled")
    .default(false)
    .notNull(),
  lastNotifiedClearAirWindowStart: text("last_notified_clear_air_window_start"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per alert-worthy DECISION (not just per send) -- an AQI category crossing
// or a high/severe migraine risk that was found during a poll cycle, whether or not
// it actually resulted in a push. This is what makes "why didn't I get an alert I
// needed" answerable: a suppressed-by-dedup or failed-delivery row leaves a trace,
// where a send-only log would look identical to "nothing happened." Cycles with no
// alert-worthy condition are not logged, to keep this readable.
export const pushNotificationLog = pgTable(
  "push_notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id").references(
      () => pushSubscriptions.id,
      { onDelete: "set null" },
    ),
    type: text("type").notNull(), // 'aqi' | 'migraine' | 'welcome'
    outcome: text("outcome").notNull(), // 'sent' | 'suppressed_dedup' | 'delivery_failed'
    title: text("title").notNull(),
    body: text("body").notNull(),
    eventAt: timestamp("event_at"), // for AQI: the forecast crossing time; null otherwise
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    subscriptionIdCreatedAtIdx: index(
      "push_notification_log_subscription_id_created_at_idx",
    ).on(table.subscriptionId, table.createdAt),
  }),
);
