import type { FastifyInstance } from 'fastify';
import { getCurrentConfig, restartWeatherPolling } from '../jobs/weather-poll.js';

interface LocationBody {
    latitude: string;
    longitude: string;
    name?: string;
}

interface GeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
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
                    name: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { latitude, longitude, name } = request.body;

        if (!latitude || !longitude) {
            return reply.status(400).send({ error: 'latitude and longitude are required' });
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return reply.status(400).send({ error: 'Invalid coordinates' });
        }

        const newConfig = await restartWeatherPolling({
            latitude: String(lat),
            longitude: String(lon),
            name: name
        });

        if (!newConfig) {
            return reply.status(500).send({ error: 'Polling not initialized yet' });
        }

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
            url.searchParams.set('count', '5');
            url.searchParams.set('language', 'en');
            url.searchParams.set('format', 'json');

            const res = await fetch(url.toString());
            const data = await res.json() as { results?: GeocodingResult[] };

            return {
                results: (data.results || []).map((r: GeocodingResult) => ({
                    name: r.name,
                    latitude: r.latitude,
                    longitude: r.longitude,
                    country: r.country,
                    state: r.admin1 || null,
                })),
            };
        } catch (error) {
            request.log.error({ msg: 'Geocoding failed', error });
            return reply.status(500).send({ error: 'Geocoding failed' });
        }
    });
}
