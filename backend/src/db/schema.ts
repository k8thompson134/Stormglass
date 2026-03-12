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
} from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  location: text('location').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Weather data from Open-Meteo API
export const weatherData = pgTable(
  'weather_data',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    location: text('location').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    pressure: numeric('pressure', { precision: 6, scale: 2 }).notNull(), // hPa
    temperature: numeric('temperature', { precision: 5, scale: 2 }).notNull(), // °C
    humidity: numeric('humidity', { precision: 5, scale: 2 }).notNull(), // %
    windSpeed: numeric('wind_speed', { precision: 5, scale: 2 }).notNull(), // m/s
    windDirection: numeric('wind_direction', { precision: 5, scale: 2 }).notNull(), // degrees
    uvIndex: numeric('uv_index', { precision: 4, scale: 2 }).notNull(),
    cloudCover: numeric('cloud_cover', { precision: 5, scale: 2 }).notNull(), // %
    precipitation: numeric('precipitation', { precision: 6, scale: 2 }).notNull(), // mm
    dewPoint: numeric('dew_point', { precision: 5, scale: 2 }).notNull(), // °C
  },
  (table) => ({
    userIdTimestampIdx: index('weather_data_user_id_timestamp_idx').on(
      table.userId,
      table.timestamp
    ),
    locationTimestampIdx: index('weather_data_location_timestamp_idx').on(
      table.location,
      table.timestamp
    ),
  })
);

// Pre-computed pressure derivatives
export const pressureDerivatives = pgTable(
  'pressure_derivatives',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    location: text('location').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    delta1h: numeric('delta_1h', { precision: 6, scale: 3 }).notNull(), // hPa/hour
    delta3h: numeric('delta_3h', { precision: 6, scale: 3 }).notNull(), // hPa/hour
    delta6h: numeric('delta_6h', { precision: 6, scale: 3 }).notNull(), // hPa/hour
    trend: text('trend', { enum: ['rising', 'falling', 'stable'] }).notNull(),
  },
  (table) => ({
    userIdTimestampIdx: index('pressure_derivatives_user_id_timestamp_idx').on(
      table.userId,
      table.timestamp
    ),
  })
);

// Air quality data from Open-Meteo Air Quality API
export const airQualityData = pgTable(
  'air_quality_data',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    location: text('location').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    pm25: numeric('pm25', { precision: 6, scale: 2 }).notNull(), // µg/m³
    pm10: numeric('pm10', { precision: 6, scale: 2 }).notNull(), // µg/m³
    ozone: numeric('ozone', { precision: 6, scale: 2 }).notNull(), // ppb
    no2: numeric('no2', { precision: 6, scale: 2 }).notNull(), // ppb
    so2: numeric('so2', { precision: 6, scale: 2 }).notNull(), // ppb
    co: numeric('co', { precision: 8, scale: 2 }).notNull(), // ppb
    usAqi: numeric('us_aqi', { precision: 5, scale: 2 }).notNull(),
    europeanAqi: numeric('european_aqi', { precision: 5, scale: 2 }).notNull(),
  },
  (table) => ({
    userIdTimestampIdx: index('air_quality_data_user_id_timestamp_idx').on(
      table.userId,
      table.timestamp
    ),
  })
);

// Geomagnetic data from NOAA
export const geomagneticData = pgTable(
  'geomagnetic_data',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    timestamp: timestamp('timestamp').notNull(),
    kpIndex: numeric('kp_index', { precision: 4, scale: 2 }).notNull(),
    kpEstimated: numeric('kp_estimated', { precision: 4, scale: 2 }).notNull(),
    solarWindSpeed: numeric('solar_wind_speed', { precision: 6, scale: 2 }).notNull(), // km/s
    solarWindDensity: numeric('solar_wind_density', { precision: 7, scale: 3 }).notNull(), // particles/cm³
  },
  (table) => ({
    userIdTimestampIdx: index('geomagnetic_data_user_id_timestamp_idx').on(
      table.userId,
      table.timestamp
    ),
  })
);

// Pollen and Mold data from Tomorrow.io
export const pollenData = pgTable(
  'pollen_data',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    location: text('location').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    treeIndex: integer('tree_index').notNull(), // 0-5
    grassIndex: integer('grass_index').notNull(), // 0-5
    weedIndex: integer('weed_index').notNull(), // 0-5
    moldIndex: integer('mold_index').notNull(), // 0-5
  },
  (table) => ({
    userIdTimestampIdx: index('pollen_data_user_id_timestamp_idx').on(
      table.userId,
      table.timestamp
    ),
    locationTimestampIdx: index('pollen_data_location_timestamp_idx').on(
      table.location,
      table.timestamp
    ),
  })
);

// Symptom logs
export const symptomLogs = pgTable(
  'symptom_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    timestamp: timestamp('timestamp').notNull(),
    severity: integer('severity').notNull(), // 1-10
    tags: jsonb('tags').$type<string[]>().default([]),
    notes: text('notes'),
    syncedAt: timestamp('synced_at'),
  },
  (table) => ({
    userIdTimestampIdx: index('symptom_logs_user_id_timestamp_idx').on(
      table.userId,
      table.timestamp
    ),
  })
);

// User-configurable alert rules
export const userAlertRules = pgTable('user_alert_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  condition: jsonb('condition').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Alert history for analysis
export const alertHistory = pgTable(
  'alert_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    ruleId: uuid('rule_id')
      .references(() => userAlertRules.id, { onDelete: 'cascade' })
      .notNull(),
    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    conditionValue: numeric('condition_value', { precision: 8, scale: 3 }).notNull(),
    acknowledged: boolean('acknowledged').default(false).notNull(),
  },
  (table) => ({
    userIdTriggeredAtIdx: index('alert_history_user_id_triggered_at_idx').on(
      table.userId,
      table.triggeredAt
    ),
  })
);

