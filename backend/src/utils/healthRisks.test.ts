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

describe("healthLogic.ts function-parity gap (known, tracked separately)", () => {
  // This intentionally documents a KNOWN gap rather than silently ignoring it --
  // backend healthLogic.ts implements only 7 of the 13 conditions the frontend
  // copy does (fibromyalgia/sinus/raynauds/sleep/cluster/eds are frontend-only),
  // so push alerts and /api/briefing structurally can't cover those 6. If this
  // count ever changes on either side, this test breaks and forces a conscious
  // update -- either the gap grew (bad, investigate) or someone closed it
  // (good, update the expected counts to match).
  it("backend has 7 shared risk functions; frontend has 13 (6 frontend-only)", () => {
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

    expect(backendFns.length).toBe(7);
    expect(frontendFns.length).toBe(13);
    // Every backend function must still exist on the frontend side (the shared
    // subset, not an independent divergent 7) -- if this fails, the two files
    // have drifted to cover different conditions, not just different COUNTS.
    for (const fn of backendFns) {
      expect(frontendFns).toContain(fn);
    }
  });
});
