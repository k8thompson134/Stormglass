import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { users } from './schema.js';
import { logger } from '../logger.js';

const DEFAULT_EMAIL = 'default@stormglass.local';

export interface DefaultUser {
  id: string;
  latitude: string;
  longitude: string;
  name: string | null;
}

// Returns the persisted user + location, creating one from the .env defaults only
// the first time this ever runs. Callers must use the RETURNED lat/lon/name to start
// polling, not the raw .env values -- otherwise every server restart would silently
// discard whatever location the user actually saved via Settings and revert to
// whatever DEFAULT_LATITUDE/LONGITUDE happens to be configured.
export async function ensureDefaultUser(): Promise<DefaultUser> {
  const existing = await db
    .select({ id: users.id, location: users.location, name: users.name })
    .from(users)
    .where(eq(users.email, DEFAULT_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    const [latitude, longitude] = existing[0].location.split(',');
    return { id: existing[0].id, latitude, longitude, name: existing[0].name };
  }

  const latitude = process.env.DEFAULT_LATITUDE || '40.7128';
  const longitude = process.env.DEFAULT_LONGITUDE || '-74.0060';
  const timezone = process.env.DEFAULT_TIMEZONE || 'America/New_York';
  const location = `${latitude},${longitude}`;

  const [newUser] = await db
    .insert(users)
    .values({
      email: DEFAULT_EMAIL,
      location,
      timezone,
    })
    .returning({ id: users.id });

  logger.info({ userId: newUser.id }, 'Created default user');
  return { id: newUser.id, latitude, longitude, name: null };
}
