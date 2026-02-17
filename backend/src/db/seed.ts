import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { users } from './schema.js';

const DEFAULT_EMAIL = 'default@stormglass.local';

export async function ensureDefaultUser(): Promise<string> {
  const latitude = process.env.DEFAULT_LATITUDE || '40.7128';
  const longitude = process.env.DEFAULT_LONGITUDE || '-74.0060';
  const timezone = process.env.DEFAULT_TIMEZONE || 'America/New_York';
  const location = `${latitude},${longitude}`;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEFAULT_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email: DEFAULT_EMAIL,
      location,
      timezone,
    })
    .returning({ id: users.id });

  console.log(`Created default user: ${newUser.id}`);
  return newUser.id;
}
