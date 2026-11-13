import { getFootprintAnchor, gridToScreen } from "@nf/shared";
import { expect, test } from "vitest";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y, anchorScreen, displaySize } from "./layout";
import { cropBobOffset } from "./bob";
import { plotPresentation } from "./plots";

test("sprites anchor on the shared bottom vertex and scale with footprint", () => {
  const anchor = getFootprintAnchor(4, 4, 4, 4);
  expect(anchor).toEqual({ gx: 8, gy: 8 });
  expect(anchorScreen(4, 4, 4, 4)).toEqual(gridToScreen(anchor.gx, anchor.gy, MAP_ORIGIN_X, MAP_ORIGIN_Y));
  expect(getFootprintAnchor(0, 0, 4, 3)).toEqual({ gx: 4, gy: 3 });
  expect(displaySize(4, 4, 1, 1)).toEqual({ width: 512, height: 512 });
  expect(displaySize(2, 2, 0.5, 0.5)).toEqual({ width: 128, height: 64 });
  expect(displaySize(1, 1, 1, 0.5)).toEqual({ width: 128, height: 64 });
});

test("a ready crop bobs 2px over 1.2s unless reduced motion is on", () => {
  expect(cropBobOffset(0, true, false)).toBeCloseTo(0);
  expect(cropBobOffset(300, true, false)).toBeCloseTo(2);
  expect(cropBobOffset(600, true, false)).toBeCloseTo(0);
  expect(cropBobOffset(900, true, false)).toBeCloseTo(-2);
  expect(cropBobOffset(300, true, true)).toBe(0);
  expect(cropBobOffset(300, false, false)).toBe(0);
});

test("agriculture plots use ground tiles, an optional prop, and a half-scale crop icon", () => {
  expect(plotPresentation("AG-001")).toEqual({
    groundAssetId: "tile_grass_flowers",
    groundTileCount: 4,
    propAssetId: null,
    overlayAssetId: "ico_goods_wheat",
    overlayScale: 0.5,
  });
  expect(plotPresentation("AG-002").propAssetId).toBe("deco_tree_oak");
  expect(plotPresentation("AG-003").propAssetId).toBe("deco_flower_patch");
  expect(plotPresentation("AG-004")).toMatchObject({
    groundAssetId: "tile_grass_flowers",
    propAssetId: "deco_flower_patch",
    overlayAssetId: "ico_goods_flowers",
  });
});
