import { eq, and, gte, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { weatherData, pressureDerivatives } from '../db/schema.js';

type Trend = 'rising' | 'falling' | 'stable';

function determineTrend(delta1h: number): Trend {
  if (delta1h > 0.1) return 'rising';
  if (delta1h < -0.1) return 'falling';
  return 'stable';
}

export async function computePressureDerivatives(
  userId: string,
  location: string
): Promise<number> {
  // Get all pressure readings for this user/location in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const readings = await db
    .select({
      timestamp: weatherData.timestamp,
      pressure: weatherData.pressure,
    })
    .from(weatherData)
    .where(
      and(
        eq(weatherData.userId, userId),
        eq(weatherData.location, location),
        gte(weatherData.timestamp, sevenDaysAgo)
      )
    )
    .orderBy(weatherData.timestamp); // Ascending for easier processing

  if (readings.length < 2) return 0;

  // Get existing derivatives to skip duplicates — limited to last 7 days
  const existingDerivatives = await db
    .select({ timestamp: pressureDerivatives.timestamp })
    .from(pressureDerivatives)
    .where(
      and(
        eq(pressureDerivatives.userId, userId),
        eq(pressureDerivatives.location, location),
        gte(pressureDerivatives.timestamp, sevenDaysAgo)
      )
    );

  const existingSet = new Set(existingDerivatives.map(d => d.timestamp.getTime()));

  const tolerance = 30 * 60 * 1000;
  let computedCount = 0;
  const newRows = [];

  // Process each reading that doesn't have a derivative yet
  for (let i = 0; i < readings.length; i++) {
    const current = readings[i];
    if (existingSet.has(current.timestamp.getTime())) continue;

    const currentTime = current.timestamp;
    const currentPressure = parseFloat(current.pressure);

    // Look back in the `readings` array to find past pressures
    const findBack = (offsetHours: number) => {
      const targetTime = currentTime.getTime() - offsetHours * 60 * 60 * 1000;
      let closest: number | null = null;
      let minDiff = tolerance;

      // Scan backwards from current point
      for (let j = i - 1; j >= 0; j--) {
        const diff = Math.abs(readings[j].timestamp.getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = parseFloat(readings[j].pressure);
        } else if (readings[j].timestamp.getTime() < targetTime - tolerance) {
          break; // Optimization: gone back too far
        }
      }
      return closest;
    };

    const p1h = findBack(1);
    const p3h = findBack(3);
    const p6h = findBack(6);

    // Only compute if at least 1h data is available
    if (p1h === null) continue;

    const delta1h = currentPressure - p1h;
    const delta3h = p3h !== null ? (currentPressure - p3h) / 3 : delta1h; // Fallback
    const delta6h = p6h !== null ? (currentPressure - p6h) / 6 : delta3h;

    const trend = determineTrend(delta1h);

    newRows.push({
      userId,
      location,
      timestamp: currentTime,
      delta1h: delta1h.toFixed(3),
      delta3h: delta3h.toFixed(3),
      delta6h: delta6h.toFixed(3),
      trend,
    });

    computedCount++;
  }

  if (newRows.length > 0) {
    await db.insert(pressureDerivatives).values(newRows);
  }

  return computedCount;
}

