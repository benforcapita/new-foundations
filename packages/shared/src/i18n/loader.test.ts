import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { catalogNameRefs } from "../content/references";
import { loadEnglishLocalization, mergeLocalization, resolveName } from "./loader";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const basePath = path.join(repoRoot, "assets", "localization_en.json");

test("every catalog name resolves to a non-empty English string", () => {
  const table = loadEnglishLocalization();
  const refs = catalogNameRefs();
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) {
    expect(resolveName(table, ref.nameKey, ref.assetId).length).toBeGreaterThan(0);
  }
  expect(resolveName(table, "building.cottage.name")).toBe("Timber Cottage");
  expect(resolveName(table, "building.cafe.name")).toBe("Café");
  expect(resolveName(table, "npc.dana.city.name")).toBe("Dana's City");
  expect(resolveName(table, "game.title")).toBe("New Foundations");
});

test("a missing nameKey falls back to asset.<assetId>.name", () => {
  const base = JSON.parse(readFileSync(basePath, "utf8")) as Record<string, string>;
  expect(resolveName(base, "building.cottage.name", "bld_res_cottage")).toBe("Timber Cottage");
  expect(() => resolveName(base, "building.cottage.name")).toThrow(/unresolved localization key/);
  expect(mergeLocalization(base, { "building.cottage.name": "Cottage" })["building.cottage.name"]).toBe("Cottage");
});
