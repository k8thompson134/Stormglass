import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extracts a `{ 'key': 'value', ... }` object literal's entries from raw source text
// (handles both single- and double-quoted keys/values, since the frontend copy uses
// double quotes for the one entry with an apostrophe). Deliberately text-based rather
// than importing the frontend module -- the two projects have separate tsconfig/module
// resolution setups, and this test only needs the literal string content, not a live
// import.
function parseGuidanceEntries(
  source: string,
  exportName: string,
): Record<string, string> {
  const blockMatch = source.match(
    new RegExp(`${exportName}[^{]*\\{([\\s\\S]*?)\\n\\};`),
  );
  if (!blockMatch) throw new Error(`Could not find ${exportName} block`);

  const entryPattern =
    /(['"])((?:\\.|(?!\1).)*)\1\s*:\s*(['"])((?:\\.|(?!\3).)*)\3/g;
  const entries: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(blockMatch[1])) !== null) {
    const key = match[2];
    const value = match[4].replace(/\\'/g, "'").replace(/\\"/g, '"');
    entries[key] = value;
  }
  return entries;
}

// Normalizes away the INTENTIONAL formatting difference between the two copies
// (backend embeds guidance lowercase/no-period after "--" in a push body; frontend
// renders it capitalized with a trailing period as its own sentence) so this test
// catches the thing that actually matters: the two saying different ADVICE.
function normalizeForComparison(text: string): string {
  return text.trim().replace(/\.$/, "").toLowerCase();
}

describe("CATEGORY_GUIDANCE stays in sync with the frontend copy", () => {
  it("has identical wording (modulo capitalization/punctuation) for every category", () => {
    const backendSource = readFileSync(
      resolve(__dirname, "./push.ts"),
      "utf-8",
    );
    const frontendSource = readFileSync(
      resolve(__dirname, "../../../frontend/src/utils/aqiCategory.ts"),
      "utf-8",
    );

    const backendEntries = parseGuidanceEntries(
      backendSource,
      "CATEGORY_GUIDANCE",
    );
    const frontendEntries = parseGuidanceEntries(
      frontendSource,
      "CATEGORY_GUIDANCE",
    );

    expect(Object.keys(backendEntries).sort()).toEqual(
      Object.keys(frontendEntries).sort(),
    );

    for (const category of Object.keys(backendEntries)) {
      expect(normalizeForComparison(backendEntries[category])).toBe(
        normalizeForComparison(frontendEntries[category]),
      );
    }
  });
});
