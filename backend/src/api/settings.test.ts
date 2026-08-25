import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const USER_ID = "11111111-1111-1111-1111-111111111111";

// Captures whatever `.set()` was called with on the last db.update(users) call, so
// tests can assert on exactly what would have been persisted.
let lastUpdateSet: Record<string, unknown> | null = null;

function makeUpdateChain() {
  const chain = {
    set: (values: Record<string, unknown>) => {
      lastUpdateSet = values;
      return chain;
    },
    where: () => Promise.resolve(undefined),
  };
  return chain;
}

vi.mock("../db/index.js", () => ({
  db: {
    update: vi.fn(() => makeUpdateChain()),
  },
}));

let restartResult: {
  userId: string;
  latitude: string;
  longitude: string;
  name?: string;
} | null = null;
vi.mock("../jobs/weather-poll.js", () => ({
  restartWeatherPolling: vi.fn(async () => restartResult),
}));
vi.mock("../services/runtime-config.js", () => ({
  getCurrentConfig: vi.fn(() => ({
    userId: USER_ID,
    latitude: "41.85003",
    longitude: "-87.65005",
  })),
}));

import { settingsRoutes } from "./settings.js";

async function buildApp() {
  const app = Fastify();
  await app.register(settingsRoutes);
  return app;
}

describe("POST /api/settings/location", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastUpdateSet = null;
    restartResult = {
      userId: USER_ID,
      latitude: "41.85003",
      longitude: "-87.65005",
      name: "Chicago, Illinois",
    };
  });

  it("persists a valid IANA timezone to the DB", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/location",
      payload: {
        latitude: "41.85003",
        longitude: "-87.65005",
        name: "Chicago, Illinois",
        timezone: "America/Chicago",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(lastUpdateSet?.timezone).toBe("America/Chicago");
    await app.close();
  });

  it("ignores an invalid timezone rather than persisting garbage or erroring", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/location",
      payload: {
        latitude: "41.85003",
        longitude: "-87.65005",
        name: "Chicago, Illinois",
        timezone: "Not/AZone",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(lastUpdateSet).not.toBeNull();
    expect(lastUpdateSet && "timezone" in lastUpdateSet).toBe(false);
    await app.close();
  });

  it("omits timezone from the update entirely when none is provided, so an existing saved value is left untouched", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/location",
      payload: {
        latitude: "41.85003",
        longitude: "-87.65005",
        name: "Chicago, Illinois",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(lastUpdateSet && "timezone" in lastUpdateSet).toBe(false);
    await app.close();
  });

  it("still updates location and name even when the timezone is invalid", async () => {
    const app = await buildApp();
    await app.inject({
      method: "POST",
      url: "/api/settings/location",
      payload: {
        latitude: "41.85003",
        longitude: "-87.65005",
        name: "Chicago, Illinois",
        timezone: "garbage",
      },
    });

    expect(lastUpdateSet?.location).toBe("41.85003,-87.65005");
    expect(lastUpdateSet?.name).toBe("Chicago, Illinois");
    await app.close();
  });

  it("rejects out-of-range coordinates with 400 before ever calling restartWeatherPolling", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/location",
      payload: { latitude: "999", longitude: "-87.65005" },
    });

    expect(response.statusCode).toBe(400);
    expect(lastUpdateSet).toBeNull();
    await app.close();
  });

  it("returns 500 without touching the DB when polling has not started yet", async () => {
    restartResult = null;
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/location",
      payload: { latitude: "41.85003", longitude: "-87.65005" },
    });

    expect(response.statusCode).toBe(500);
    expect(lastUpdateSet).toBeNull();
    await app.close();
  });
});
