import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  findNextCategoryCrossing,
  findCategoryClearTime,
  findSafeWindows,
  nextSafeWindow,
  getCategoryCeiling,
  classifyAqiCategory,
  CATEGORY_ORDER,
} from "../utils/aqiWindows.js";
import {
  isPushConfigured,
  sendAqiCrossingAlert,
  clearAqiCrossingDedupState,
  sendCurrentAqiBadAlert,
  clearCurrentAqiBadDedupState,
  sendMigraineRiskAlert,
  clearMigraineRiskDedupState,
  sendMecfsRiskAlert,
  clearMecfsRiskDedupState,
  sendPotsRiskAlert,
  clearPotsRiskDedupState,
  sendSinusRiskAlert,
  clearSinusRiskDedupState,
  sendClusterHeadacheRiskAlert,
  clearClusterHeadacheRiskDedupState,
  sendFibromyalgiaRiskAlert,
  clearFibromyalgiaRiskDedupState,
  sendClearAirAlert,
  resetClearAirDedupState,
} from "../services/push.js";
import {
  getMigraineRisk,
  getMECFSRisk,
  getPOTSRisk,
  getSinusRisk,
  getClusterHeadacheRisk,
  getFibromyalgiaRisk,
} from "../utils/healthLogic.js";
import { db } from "../db/index.js";
import {
  airQualityData,
  pressureDerivatives,
  weatherData,
  pollenData,
} from "../db/schema.js";
import { logger } from "../logger.js";

interface AqiPoint {
  timestamp: Date;
  usAqi: number;
}

export interface AqiWindow {
  now: Date;
  currentPoint: AqiPoint;
  futurePoints: AqiPoint[];
}

/**
 * Fetches "the current AQI reading plus the forecast ahead of it" once per poll
 * cycle -- both checkAqiCategoryCrossing (crossing detection) and checkMigraineRisk
 * (feeds AQI into the risk calc) need the current reading, and used to each query
 * airQualityData separately for it.
 */
export async function fetchAqiWindow(
  location: string,
): Promise<AqiWindow | null> {
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60 * 1000); // 1h back, enough to find "current"
  const until = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const rows = await db
    .select({
      timestamp: airQualityData.timestamp,
      usAqi: airQualityData.usAqi,
    })
    .from(airQualityData)
    .where(
      and(
        gte(airQualityData.timestamp, since),
        lte(airQualityData.timestamp, until),
        eq(airQualityData.location, location),
      ),
    )
    .orderBy(airQualityData.timestamp)
    .limit(200);

  if (rows.length === 0) return null;

  const points = rows.map((r) => ({
    timestamp: r.timestamp,
    usAqi: parseFloat(r.usAqi),
  }));
  const pastPoints = points.filter((p) => p.timestamp <= now);
  const currentPoint = pastPoints[pastPoints.length - 1] ?? points[0];
  const futurePoints = points.filter((p) => p.timestamp > now);

  return { now, currentPoint, futurePoints };
}

export interface LatestDerivative {
  delta1h: number;
  delta3h: number;
  delta6h: number;
}

/**
 * Fetched once per poll cycle and shared by every pressure-derived risk check
 * (migraine, ME/CFS, POTS) -- these used to each run their own identical query.
 */
export async function fetchLatestDerivative(
  userId: string,
  location: string,
): Promise<LatestDerivative | null> {
  const [row] = await db
    .select({
      delta1h: pressureDerivatives.delta1h,
      delta3h: pressureDerivatives.delta3h,
      delta6h: pressureDerivatives.delta6h,
    })
    .from(pressureDerivatives)
    .where(
      and(
        eq(pressureDerivatives.userId, userId),
        eq(pressureDerivatives.location, location),
      ),
    )
    .orderBy(desc(pressureDerivatives.timestamp))
    .limit(1);

  if (!row) return null;
  return {
    delta1h: parseFloat(row.delta1h),
    delta3h: parseFloat(row.delta3h),
    delta6h: parseFloat(row.delta6h),
  };
}

export interface LatestWeather {
  humidity: number;
  temperature: number;
  uvIndex: number;
}

/**
 * Latest humidity/temperature/UV reading -- POTS/fibromyalgia risk need the first
 * two alongside pressure; cluster headache risk needs UV index (bright light is
 * one of its two triggers, alongside pressure drops).
 */
export async function fetchLatestWeather(
  userId: string,
  location: string,
): Promise<LatestWeather | null> {
  const [row] = await db
    .select({
      humidity: weatherData.humidity,
      temperature: weatherData.temperature,
      uvIndex: weatherData.uvIndex,
    })
    .from(weatherData)
    .where(
      and(eq(weatherData.userId, userId), eq(weatherData.location, location)),
    )
    .orderBy(desc(weatherData.timestamp))
    .limit(1);

  if (!row) return null;
  return {
    humidity: parseFloat(row.humidity),
    temperature: parseFloat(row.temperature),
    uvIndex: parseFloat(row.uvIndex),
  };
}

// Pollen updates once a day (see services/pollen.ts), a much slower cadence than
// the 30-min weather poll this is read from -- unlike fetchLatestDerivative/
// fetchLatestWeather (which have no staleness cutoff because a stalled 30-min
// poll surfaces as an outage everyone notices fast), a stalled DAILY pollen fetch
// could quietly keep returning a days-old "elevated" index forever, silently
// biasing sinus risk upward with no visible symptom. Treat anything older than
// this as "no data" rather than trusting it indefinitely.
const POLLEN_STALENESS_LIMIT_MS = 48 * 60 * 60 * 1000;

/**
 * Latest max pollen index across tree/grass/weed/mold -- sinus risk's pollenMax
 * input. Separate fetch (not folded into fetchLatestWeather) since pollen_data is
 * its own table on its own polling cadence, not part of weatherData.
 */
export async function fetchLatestPollenMax(
  userId: string,
  location: string,
): Promise<number | null> {
  const [row] = await db
    .select({
      timestamp: pollenData.timestamp,
      treeIndex: pollenData.treeIndex,
      grassIndex: pollenData.grassIndex,
      weedIndex: pollenData.weedIndex,
      moldIndex: pollenData.moldIndex,
    })
    .from(pollenData)
    .where(
      and(eq(pollenData.userId, userId), eq(pollenData.location, location)),
    )
    .orderBy(desc(pollenData.timestamp))
    .limit(1);

  if (!row) return null;
  if (Date.now() - row.timestamp.getTime() > POLLEN_STALENESS_LIMIT_MS) {
    return null;
  }
  return Math.max(row.treeIndex, row.grassIndex, row.weedIndex, row.moldIndex);
}

/**
 * Runs every poll cycle so a spike in migraine risk reaches you even if the app
 * isn't open -- only alerts on high/severe (not moderate) since pressure risk
 * oscillates far more than AQI category and a lower threshold would cry wolf.
 */
export async function checkMigraineRisk(
  latestDerivative: LatestDerivative | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative) return;

  try {
    const risk = getMigraineRisk(
      latestDerivative.delta1h,
      latestDerivative.delta3h,
      latestDerivative.delta6h,
      currentAqi,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      await sendMigraineRiskAlert({
        riskLevel: risk.risk,
        delta1h: latestDerivative.delta1h,
      });
    } else {
      await clearMigraineRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `Migraine risk check failed: ${error}`);
  }
}

/**
 * Runs every poll cycle -- same high/severe-only threshold reasoning as migraine
 * above, since ME/CFS pressure-volatility risk oscillates on a similar timescale.
 */
export async function checkMecfsRisk(
  latestDerivative: LatestDerivative | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative) return;

  try {
    const risk = getMECFSRisk(
      latestDerivative.delta1h,
      latestDerivative.delta3h,
      latestDerivative.delta6h,
      currentAqi,
    );
    const volatility =
      Math.abs(latestDerivative.delta1h) +
      Math.abs(latestDerivative.delta3h) +
      Math.abs(latestDerivative.delta6h);

    if (risk.risk === "high" || risk.risk === "severe") {
      await sendMecfsRiskAlert({ riskLevel: risk.risk, volatility });
    } else {
      await clearMecfsRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `ME/CFS risk check failed: ${error}`);
  }
}

/**
 * Runs every poll cycle -- needs the latest weather reading (humidity/temperature)
 * in addition to the pressure derivative every other risk check uses, since POTS
 * risk is driven by heat/cold/humidity stacking with pressure swings, not pressure
 * alone.
 */
export async function checkPotsRisk(
  latestDerivative: LatestDerivative | null,
  latestWeather: LatestWeather | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative || !latestWeather) return;

  try {
    const risk = getPOTSRisk(
      latestDerivative.delta1h,
      latestWeather.humidity,
      latestWeather.temperature,
      currentAqi,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      // getPOTSRisk computes its own primaryStressor internally (for its detailed
      // explanation text) but doesn't return it as part of HealthRisk -- mirrors its
      // isHot(>24)/isCold(<5) thresholds here rather than widen the shared HealthRisk
      // type just for this one alert's phrasing. isVeryHot(>30)/isVeryCold(<-5) don't
      // need separate checks: both are subsets already caught by isHot/isCold.
      const tempF = Math.round((latestWeather.temperature * 9) / 5 + 32);
      const isHot = latestWeather.temperature > 24;
      const isCold = latestWeather.temperature < 5;
      const primaryStressor = isHot ? "heat" : isCold ? "cold" : "pressure";
      await sendPotsRiskAlert({ riskLevel: risk.risk, primaryStressor, tempF });
    } else {
      await clearPotsRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `POTS risk check failed: ${error}`);
  }
}

/**
 * Runs every poll cycle -- needs the latest weather reading plus the latest pollen
 * max, since sinus risk is driven by pressure/humidity/temperature/allergen
 * exposure stacking together, not pressure alone.
 */
export async function checkSinusRisk(
  latestDerivative: LatestDerivative | null,
  latestWeather: LatestWeather | null,
  pollenMax: number | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative || !latestWeather) return;

  try {
    const risk = getSinusRisk(
      latestDerivative.delta1h,
      latestWeather.humidity,
      latestWeather.temperature,
      pollenMax ?? 0,
      currentAqi,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      // Mirrors getSinusRisk's own thresholds (absD>0.4, humidity>65, usAqi>50)
      // so the alert only names factors that actually crossed the line, rather
      // than a fixed "pressure and humidity" story that may not be what's
      // driving this particular score (pollen or AQI alone can also reach
      // high/severe).
      await sendSinusRiskAlert({
        riskLevel: risk.risk,
        pollenMax: pollenMax ?? 0,
        pressureElevated: Math.abs(latestDerivative.delta1h) > 0.4,
        humidityElevated: latestWeather.humidity > 65,
        aqiElevated: currentAqi !== null && currentAqi > 50,
      });
    } else {
      await clearSinusRiskDedupState();
    }
  } catch (error) {
    logger.error({ service: "push" }, `Sinus risk check failed: ${error}`);
  }
}

/**
 * Runs every poll cycle -- cluster headache is triggered specifically by pressure
 * DROPS (not rises, unlike migraine) and bright/UV light, so needs the latest UV
 * reading alongside the pressure derivative.
 */
export async function checkClusterHeadacheRisk(
  latestDerivative: LatestDerivative | null,
  latestWeather: LatestWeather | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative || !latestWeather) return;

  try {
    const risk = getClusterHeadacheRisk(
      latestDerivative.delta1h,
      latestDerivative.delta3h,
      latestDerivative.delta6h,
      latestWeather.uvIndex,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      // Mirrors getClusterHeadacheRisk's own thresholds (delta1h<-0.4,
      // delta3h<-1.5, delta6h<-3.0) to find which window actually triggered --
      // a 3h/6h-driven score can have delta1h flat or positive, so always
      // reporting delta1h would misdescribe what's happening right now.
      const candidates: { window: "1h" | "3h" | "6h"; value: number }[] = [
        { window: "1h", value: latestDerivative.delta1h },
        { window: "3h", value: latestDerivative.delta3h },
        { window: "6h", value: latestDerivative.delta6h },
      ];
      const dominant = candidates.reduce((a, b) => (b.value < a.value ? b : a));
      await sendClusterHeadacheRiskAlert({
        riskLevel: risk.risk,
        dominantWindow: dominant.window,
        dominantValue: dominant.value,
        uvHigh: latestWeather.uvIndex >= 5,
      });
    } else {
      await clearClusterHeadacheRiskDedupState();
    }
  } catch (error) {
    logger.error(
      { service: "push" },
      `Cluster headache risk check failed: ${error}`,
    );
  }
}

/**
 * Runs every poll cycle -- fibromyalgia risk is driven by cold/damp/pressure
 * stacking together, same inputs as POTS/joint-pain but its own dedup state since
 * it oscillates on its own schedule.
 */
export async function checkFibromyalgiaRisk(
  latestDerivative: LatestDerivative | null,
  latestWeather: LatestWeather | null,
  currentAqi: number | null,
): Promise<void> {
  if (!isPushConfigured() || !latestDerivative || !latestWeather) return;

  try {
    const risk = getFibromyalgiaRisk(
      latestDerivative.delta1h,
      latestWeather.humidity,
      latestWeather.temperature,
      currentAqi,
    );

    if (risk.risk === "high" || risk.risk === "severe") {
      // Mirrors getFibromyalgiaRisk's own thresholds (absD>0.5, temp<10,
      // temp>28, humidity>60) -- heat+humidity alone (pressure flat) can also
      // reach high/severe, so the alert must not unconditionally claim
      // "cold, damp, and pressure changes."
      await sendFibromyalgiaRiskAlert({
        riskLevel: risk.risk,
        isCold: latestWeather.temperature < 10,
        isHot: latestWeather.temperature > 28,
        isDamp: latestWeather.humidity > 60,
        pressureElevated: Math.abs(latestDerivative.delta1h) > 0.5,
      });
    } else {
      await clearFibromyalgiaRiskDedupState();
    }
  } catch (error) {
    logger.error(
      { service: "push" },
      `Fibromyalgia risk check failed: ${error}`,
    );
  }
}

// Only alert on a forecast crossing once it's this close -- a crossing found further
// out is real but not yet actionable, and pushing for it immediately (a 72h scan
// used to fire as soon as ANY future crossing was found) is exactly what produced
// alerts landing at odd hours for events well over half a day away. Each 30-min poll
// re-evaluates, so as a distant crossing gets closer it naturally enters this window
// and fires once -- nothing is lost, it's just not pushed before it's relevant.
const AQI_ALERT_LOOKAHEAD_MS = 3 * 60 * 60 * 1000;

// Threshold for "bad right now" -- matches the app's own "safe to go outside" cutoff
// (AQI_CONFIG / the aqi-forecast endpoint's default threshold of 100).
const CURRENT_BAD_THRESHOLD_CATEGORY_IDX = CATEGORY_ORDER.indexOf(
  "Unhealthy for Sensitive Groups",
);

/**
 * Runs on every poll cycle (not just when the frontend happens to be open) so a
 * worsening AQI forecast reaches you even if the app isn't sitting open in a tab --
 * the whole point of push notifications over the in-app-only banner.
 */
export async function checkAqiCategoryCrossing(
  location: string,
  aqiWindow: AqiWindow | null,
): Promise<void> {
  if (!isPushConfigured()) return;
  if (!aqiWindow) return;

  try {
    const { now, currentPoint, futurePoints } = aqiWindow;
    const crossing = findNextCategoryCrossing(
      currentPoint.usAqi,
      futurePoints,
      now,
    );

    if (
      crossing &&
      crossing.at.getTime() - now.getTime() <= AQI_ALERT_LOOKAHEAD_MS
    ) {
      // "When does it clear" -- scanned from the crossing point forward through the
      // same futurePoints already fetched this cycle, so the alert can say "until
      // ~9pm" instead of just "starting at 4pm" when the forecast actually shows an
      // end to it within the lookahead window.
      const toCategoryIdx = CATEGORY_ORDER.indexOf(crossing.toCategory);
      const clearAt = findCategoryClearTime(
        futurePoints,
        crossing.at,
        toCategoryIdx,
      );
      await sendAqiCrossingAlert({
        toCategory: crossing.toCategory,
        usAqi: crossing.usAqi,
        at: crossing.at.toISOString(),
        clearAt: clearAt ? clearAt.toISOString() : null,
      });
    } else if (!crossing) {
      await clearAqiCrossingDedupState();
    }
    // else: crossing found but still outside the lookahead window -- leave dedup
    // state alone, it'll be evaluated again next poll as it gets closer. (Dedup
    // itself is keyed on category+date, not category alone, so a later crossing
    // into the same category on a different day still fires -- see push.ts.)

    // "Bad right now" is evaluated independently of the forecast crossing above --
    // it can fire even if the crossing alert already covered this same worsening,
    // and it's the one that catches "AQI is bad and the forecast heads-up already
    // fired hours ago" or "AQI worsened faster than the forecast predicted."
    const currentCategory = classifyAqiCategory(currentPoint.usAqi);
    if (
      CATEGORY_ORDER.indexOf(currentCategory) >=
      CURRENT_BAD_THRESHOLD_CATEGORY_IDX
    ) {
      const clearAt = findCategoryClearTime(
        futurePoints,
        now,
        CURRENT_BAD_THRESHOLD_CATEGORY_IDX,
      );
      await sendCurrentAqiBadAlert({
        category: currentCategory,
        usAqi: currentPoint.usAqi,
        clearAt: clearAt ? clearAt.toISOString() : null,
      });
    } else {
      await clearCurrentAqiBadDedupState();
    }
  } catch (error) {
    logger.error(
      { service: "push" },
      `AQI category-crossing check failed: ${error}`,
    );
  }
}

// "Safe" ceiling for the clean-air alert -- matches CURRENT_BAD_THRESHOLD_CATEGORY_IDX
// above (Moderate and below is "safe," USG and up is "bad"). There's no per-user
// sensitivity threshold available here (that preference lives in frontend
// localStorage only, never sent to the backend poll job), so this uses the same
// fixed cutoff the other AQI alerts already use rather than guessing a threshold.
const CLEAR_AIR_THRESHOLD = getCategoryCeiling("Moderate");

// Ignore windows shorter than this -- a 20-minute gap between two bad stretches
// isn't a real "good time to go outside," it's noise in the hourly forecast data.
const MIN_CLEAR_AIR_WINDOW_HOURS = 2;

/**
 * Runs on every poll cycle -- the positive-framing complement to the "bad right
 * now"/"worsening soon" alerts above: tells you when a genuinely clean stretch is
 * coming up, for planning outdoor time, rather than only reacting to bad air.
 * Reuses findSafeWindows/nextSafeWindow, already built for (and used by) the in-app
 * AQI forecast chart -- this is the same computation, just also pushed.
 */
export async function checkClearAirWindow(
  aqiWindow: AqiWindow | null,
): Promise<void> {
  if (!isPushConfigured() || !aqiWindow) return;

  try {
    const { now, currentPoint, futurePoints } = aqiWindow;
    const points = [currentPoint, ...futurePoints];
    const windows = findSafeWindows(points, CLEAR_AIR_THRESHOLD, now);
    const next = nextSafeWindow(windows, now);

    // Only alert on an UPCOMING window (not one already underway -- "starting soon"
    // wouldn't be true of right now) that's close enough to be actionable (same
    // lookahead as the AQI crossing alert) and long enough to be worth planning
    // around.
    if (
      next &&
      !next.isCurrent &&
      next.start.getTime() - now.getTime() <= AQI_ALERT_LOOKAHEAD_MS &&
      next.durationHours >= MIN_CLEAR_AIR_WINDOW_HOURS
    ) {
      await sendClearAirAlert({
        startAt: next.start.toISOString(),
        endAt: next.end.toISOString(),
        durationHours: next.durationHours,
        avgAqi: next.avgAqi,
      });
    } else if (!next || next.isCurrent) {
      // No upcoming window found, or the "safe" window is the one we're already in
      // -- either way there's nothing left to announce, so clear dedup so a later
      // genuinely new window isn't silently skipped.
      await resetClearAirDedupState();
    }
    // else: window found but still outside the lookahead, or too short -- leave
    // dedup alone, re-evaluated next poll as it either gets closer or resolves.
  } catch (error) {
    logger.error(
      { service: "push" },
      `Clear-air window check failed: ${error}`,
    );
  }
}
