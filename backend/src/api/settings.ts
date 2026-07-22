import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { getCurrentConfig, restartWeatherPolling } from '../jobs/weather-poll.js';

interface LocationBody {
    latitude: string;
    longitude: string;
    name?: string;
    timezone?: string;
}

interface GeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
    feature_code?: string;
    population?: number;
    timezone?: string;
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {

    // GET /api/settings — return current location config
    app.get('/api/settings', async () => {
        const config = getCurrentConfig();
        return {
            latitude: config?.latitude || process.env.DEFAULT_LATITUDE || '40.7128',
            longitude: config?.longitude || process.env.DEFAULT_LONGITUDE || '-74.0060',
            name: config?.name || null
        };
    });

    // POST /api/settings/location — update location and restart polling
    app.post<{ Body: LocationBody }>('/api/settings/location', {
        schema: {
            body: {
                type: 'object',
                required: ['latitude', 'longitude'],
                properties: {
                    latitude: { type: 'string' },
                    longitude: { type: 'string' },
                    name: { type: 'string' },
                    timezone: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { latitude, longitude, name, timezone } = request.body;

        if (!latitude || !longitude) {
            return reply.status(400).send({ error: 'latitude and longitude are required' });
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return reply.status(400).send({ error: 'Invalid coordinates' });
        }

        // Only accept a real IANA zone name -- an invalid value here would silently
        // break local-day grouping in aqi-burden (it falls back to UTC, but better to
        // just not persist garbage in the first place).
        let validTimezone: string | undefined;
        if (timezone) {
            try {
                new Intl.DateTimeFormat('en-US', { timeZone: timezone });
                validTimezone = timezone;
            } catch {
                request.log.warn({ timezone }, 'Ignoring invalid timezone in location update');
            }
        }

        const newConfig = await restartWeatherPolling({
            latitude: String(lat),
            longitude: String(lon),
            name: name
        });

        if (!newConfig) {
            return reply.status(500).send({ error: 'Polling not initialized yet' });
        }

        // Persist to the DB, not just in-memory -- otherwise the next server
        // restart (deploy, crash) silently reverts to whatever .env's
        // DEFAULT_LATITUDE/LONGITUDE happens to be, discarding this change.
        await db
            .update(users)
            .set({
                location: `${newConfig.latitude},${newConfig.longitude}`,
                name: newConfig.name ?? null,
                ...(validTimezone ? { timezone: validTimezone } : {}),
                updatedAt: new Date(),
            })
            .where(eq(users.id, newConfig.userId));

        return {
            success: true,
            latitude: newConfig.latitude,
            longitude: newConfig.longitude,
            name: newConfig.name
        };
    });

    // GET /api/geocode?q=city — proxy to Open-Meteo geocoding API
    app.get<{ Querystring: { q: string } }>('/api/geocode', async (request, reply) => {
        const query = request.query.q;
        if (!query || query.length < 2) {
            return reply.status(400).send({ error: 'Query must be at least 2 characters' });
        }

        try {
            const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
            url.searchParams.set('name', query);
            url.searchParams.set('count', '8');
            url.searchParams.set('language', 'en');
            url.searchParams.set('format', 'json');

            const res = await fetch(url.toString());
            const data = await res.json() as { results?: GeocodingResult[] };

            // Populated places (cities/towns/villages -- GeoNames feature codes
            // starting "PPL") sort ahead of same-named geographic features (a
            // dam, park, mountain) that can otherwise outrank the actual city a
            // user searched for. Ties within each group break by population.
            const results = (data.results || [])
                .slice()
                .sort((a, b) => {
                    const aPlace = (a.feature_code || '').startsWith('PPL') ? 1 : 0;
                    const bPlace = (b.feature_code || '').startsWith('PPL') ? 1 : 0;
                    if (aPlace !== bPlace) return bPlace - aPlace;
                    return (b.population || 0) - (a.population || 0);
                })
                .slice(0, 5)
                .map((r: GeocodingResult) => ({
                    name: r.name,
                    latitude: r.latitude,
                    longitude: r.longitude,
                    country: r.country,
                    state: r.admin1 || null,
                    timezone: r.timezone || null,
                }));

            return { results };
        } catch (error) {
            request.log.error({ msg: 'Geocoding failed', error });
            return reply.status(500).send({ error: 'Geocoding failed' });
        }
    });
}
