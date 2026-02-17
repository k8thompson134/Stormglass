import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from CWD (when running from backend/)
config();
// Also load from project root (parent of backend/)
config({ path: resolve(process.cwd(), '../.env') });

// --- Environment validation ---

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[env] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3000'), 10),
  HOST: optional('HOST', '0.0.0.0'),

  DATABASE_URL: required('DATABASE_URL'),

  DEFAULT_LATITUDE: optional('DEFAULT_LATITUDE', '40.7128'),
  DEFAULT_LONGITUDE: optional('DEFAULT_LONGITUDE', '-74.0060'),

  // In production, CORS_ORIGIN must be set explicitly
  CORS_ORIGIN: isProduction
    ? required('CORS_ORIGIN')
    : process.env.CORS_ORIGIN || null,

  // Optional API key — pollen data will be skipped if missing
  TOMORROW_API_KEY: process.env.TOMORROW_API_KEY?.trim() || null,

  // Auth token for API access (required in production)
  API_TOKEN: isProduction
    ? required('API_TOKEN')
    : process.env.API_TOKEN?.trim() || null,
} as const;
