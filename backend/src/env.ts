import { config } from "dotenv";
import { resolve } from "path";
import { randomBytes } from "crypto";
import { appendFileSync } from "fs";

// Load .env from CWD (when running from backend/)
config();
// Also load from project root (parent of backend/)
config({ path: resolve(process.cwd(), "../.env") });

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

const isProduction = process.env.NODE_ENV === "production";

function getOrGenerateApiToken(): string | null {
  const existing = process.env.API_TOKEN?.trim();
  if (existing) return existing;
  if (!isProduction) return null;

  const token = randomBytes(32).toString("hex");

  // Persist to .env so the token survives restarts
  const envPath = resolve(process.cwd(), "../.env");
  try {
    appendFileSync(envPath, `\nAPI_TOKEN=${token}\n`, "utf8");
  } catch {
    // .env not writable — token is still usable this session, just won't persist
    console.warn(
      "[env] Could not write API_TOKEN to .env — add it manually to persist across restarts",
    );
  }

  // Make it available to the rest of this process
  process.env.API_TOKEN = token;

  const bar = "=".repeat(60);
  console.log(`\n${bar}`);
  console.log("  API TOKEN GENERATED (first startup)");
  console.log(`  ${token}`);
  console.log("  Saved to .env — use this as your Bearer token in OpenClaw");
  console.log(`${bar}\n`);

  return token;
}

export const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: parseInt(optional("PORT", "3000"), 10),
  HOST: optional("HOST", "0.0.0.0"),

  DATABASE_URL: required("DATABASE_URL"),

  // In production, CORS_ORIGIN must be set explicitly
  CORS_ORIGIN: isProduction
    ? required("CORS_ORIGIN")
    : process.env.CORS_ORIGIN || null,

  // Optional API key — pollen data will be skipped if missing
  TOMORROW_API_KEY: process.env.TOMORROW_API_KEY?.trim() || null,

  // Optional API key — hyperlocal PurpleAir AQI overlay is skipped (falls back to
  // Open-Meteo's modeled AQI) if missing. Free key: https://develop.purpleair.com
  PURPLEAIR_API_KEY: process.env.PURPLEAIR_API_KEY?.trim() || null,

  // Auth token for API access — auto-generated on first production startup if not set
  API_TOKEN: getOrGenerateApiToken(),

  // Optional Web Push credentials — AQI category-crossing push alerts are skipped
  // entirely (subscribe endpoint returns 503) if either half of the pair is unset.
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY?.trim() || null,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY?.trim() || null,
  VAPID_SUBJECT:
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com",
} as const;
