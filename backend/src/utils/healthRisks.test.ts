import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extracts { level, min } threshold pairs, in order, for a given `export const
// XXX_CONFIG` block. Deliberately ignores everything else in each threshold object
// (description/detailedExplanation/factors/recommendations prose) -- that copy is
// allowed to read slightly differently between the two projects (see the
// CATEGORY_GUIDANCE precedent in push.test.ts); what must never silently drift is
// the actual NUMBER that decides which risk level someone gets shown. No RiskConfig
// in either copy currently uses `max`, only `min` -- if that changes, this parser
// needs a matching update, which is the point: it should break loudly rather than
// silently stop checking something.
function parseConfigThresholds(
  source: string,
  configName: string,
): Array<{ level: string; min: number }> {
  const blockMatch = source.match(
    new RegExp(`export const ${configName}[^{]*\\{([\\s\\S]*?)\\n\\};`),
  );
  if (!blockMatch) throw new Error(`Could not find ${configName} block`);

  const pattern = /level:\s*"(\w+)",\s*\n\s*min:\s*(-?[\d.]+),/g;
  const thresholds: Array<{ level: string; min: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(blockMatch[1])) !== null) {
    thresholds.push({ level: match[1], min: parseFloat(match[2]) });
  }
  if (thresholds.length === 0) {
    throw new Error(
      `Found no level/min pairs in ${configName} -- parser is stale`,
    );
  }
  return thresholds;
}

const SHARED_CONFIGS = [
  "MIGRAINE_CONFIG",
  "MECFS_CONFIG",
  "GEOMAGNETIC_CONFIG",
  "AQI_CONFIG",
];

describe("healthRisks.ts threshold numbers stay in sync with the frontend copy", () => {
  const backendSource = readFileSync(
    resolve(__dirname, "./healthRisks.ts"),
    "utf-8",
  );
  const frontendSource = readFileSync(
    resolve(__dirname, "../../../frontend/src/utils/healthRisks.ts"),
    "utf-8",
  );

  for (const configName of SHARED_CONFIGS) {
    it(`${configName} has identical level/min thresholds on both sides`, () => {
      const backendThresholds = parseConfigThresholds(
        backendSource,
        configName,
      );
      const frontendThresholds = parseConfigThresholds(
        frontendSource,
        configName,
      );
      expect(backendThresholds).toEqual(frontendThresholds);
    });
  }
});

describe("aqiWindows.ts classification math stays in sync with frontend aqiCategory.ts", () => {
  const backendSource = readFileSync(
    resolve(__dirname, "./aqiWindows.ts"),
    "utf-8",
  );
  const frontendSource = readFileSync(
    resolve(__dirname, "../../../frontend/src/utils/aqiCategory.ts"),
    "utf-8",
  );

  // Extracts the `if (usAqi >= N) return "Category";` ladder from
  // classifyAqiCategory, in order -- the actual EPA breakpoint numbers.
  function parseClassifyBreakpoints(
    source: string,
  ): Array<{ threshold: number; category: string }> {
    const blockMatch = source.match(
      /function classifyAqiCategory[^{]*\{([\s\S]*?)\n\}/,
    );
    if (!blockMatch) throw new Error("Could not find classifyAqiCategory");
    const pattern = /if\s*\(usAqi\s*>=\s*(\d+)\)\s*return\s*"([^"]+)"/g;
    const breakpoints: Array<{ threshold: number; category: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(blockMatch[1])) !== null) {
      breakpoints.push({
        threshold: parseInt(match[1], 10),
        category: match[2],
      });
    }
    if (breakpoints.length === 0) {
      throw new Error("Found no breakpoints -- parser is stale");
    }
    return breakpoints;
  }

  // Extracts the SEVERITY_FACTOR record's { Category: number } entries.
  function parseSeverityFactor(source: string): Record<string, number> {
    const blockMatch = source.match(/SEVERITY_FACTOR[^{]*\{([\s\S]*?)\n\};/);
    if (!blockMatch) throw new Error("Could not find SEVERITY_FACTOR");
    const pattern = /(['"]?)([\w ]+)\1:\s*([\d.]+),/g;
    const entries: Record<string, number> = {};
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(blockMatch[1])) !== null) {
      entries[match[2]] = parseFloat(match[3]);
    }
    if (Object.keys(entries).length === 0) {
      throw new Error("Found no SEVERITY_FACTOR entries -- parser is stale");
    }
    return entries;
  }

  it("classifyAqiCategory has identical breakpoints on both sides", () => {
    expect(parseClassifyBreakpoints(backendSource)).toEqual(
      parseClassifyBreakpoints(frontendSource),
    );
  });

  it("SEVERITY_FACTOR has identical values on both sides", () => {
    expect(parseSeverityFactor(backendSource)).toEqual(
      parseSeverityFactor(frontendSource),
    );
  });
});

describe("healthLogic.ts function parity between frontend and backend", () => {
  // Closed 2026-08-24 (task 403) -- backend now ports all 13 risk functions the
  // frontend has (fibromyalgia/sinus/raynauds/sleep/cluster/eds were previously
  // frontend-only, meaning push alerts and /api/briefing structurally couldn't
  // cover those 6 conditions). This asserts full parity rather than documenting
  // a gap -- if either side adds/removes a function without the other, this
  // breaks and forces a conscious update.
  it("backend and frontend export the exact same 13 risk functions", () => {
    const backendSource = readFileSync(
      resolve(__dirname, "./healthLogic.ts"),
      "utf-8",
    );
    const frontendSource = readFileSync(
      resolve(__dirname, "../../../frontend/src/utils/healthLogic.ts"),
      "utf-8",
    );

    const extractFunctionNames = (source: string): string[] =>
      [...source.matchAll(/^export function (get\w+Risk)/gm)].map((m) => m[1]);

    const backendFns = extractFunctionNames(backendSource).sort();
    const frontendFns = extractFunctionNames(frontendSource).sort();

    expect(backendFns.length).toBe(13);
    expect(backendFns).toEqual(frontendFns);
  });
});
