import englishBase from "../../../../assets/localization_en.json" with { type: "json" };
import englishOverrides from "./localization_en.overrides.json" with { type: "json" };

export type LocalizationTable = Readonly<Record<string, string>>;

export function asLocalizationTable(value: unknown, label: string): LocalizationTable {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a string map`);
  }
  const table: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label} entry ${key} must be a non-empty string`);
    }
    table[key] = entry;
  }
  return table;
}

export function mergeLocalization(base: LocalizationTable, overrides: LocalizationTable): LocalizationTable {
  return { ...base, ...overrides };
}

export function loadEnglishLocalization(): LocalizationTable {
  return mergeLocalization(
    asLocalizationTable(englishBase, "assets/localization_en.json"),
    asLocalizationTable(englishOverrides, "localization_en.overrides.json"),
  );
}

export function resolveName(table: LocalizationTable, nameKey: string, assetId?: string): string {
  const direct = table[nameKey];
  if (direct !== undefined && direct.length > 0) {
    return direct;
  }
  if (assetId !== undefined) {
    const fallback = table[`asset.${assetId}.name`];
    if (fallback !== undefined && fallback.length > 0) {
      return fallback;
    }
  }
  throw new Error(`unresolved localization key ${nameKey}`);
}
