import { expect, test } from "vitest";
import { bundledPngIds, resolveAssetUrl } from "./assetUrls";

test("vite resolves catalog pngs from the repo assets directory", () => {
  expect(bundledPngIds()).toContain("bld_civic_townhall");
  expect(bundledPngIds()).toContain("tile_grass");
  expect(bundledPngIds()).toContain("tile_road_cross");
  expect(bundledPngIds()).toContain("ico_ui_alert");
  expect(bundledPngIds()).toContain("ico_goods_wheat");
  expect(bundledPngIds()).toContain("deco_tree_oak");
  expect(resolveAssetUrl("bld_civic_townhall")).toContain("bld_civic_townhall.png");
  expect(resolveAssetUrl("tile_shore")).toContain("tile_shore.png");
  expect(resolveAssetUrl("ico_ui_check")).toContain("ico_ui_check.png");
});
