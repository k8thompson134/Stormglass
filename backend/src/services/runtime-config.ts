// Holds the single active polling location as in-memory runtime state -- this app
// only ever polls one location at a time, so there's no per-user config table, just
// this module-level singleton set by weather-poll.ts's cron lifecycle and read by
// every route that needs to know "what location is this server currently watching."
// Split out from jobs/weather-poll.ts so those routes don't have to import a cron
// scheduling module just to read the current location.
export interface PollConfig {
  userId: string;
  latitude: string;
  longitude: string;
  name?: string;
}

let currentConfig: PollConfig | null = null;

export function getCurrentConfig(): PollConfig | null {
  return currentConfig;
}

export function setCurrentConfig(config: PollConfig | null): void {
  currentConfig = config;
}
