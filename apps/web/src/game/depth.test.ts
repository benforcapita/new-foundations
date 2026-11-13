import { expect, test } from "vitest";
import { GROUND_DEPTH, ROAD_DEPTH, footprintDepth, overlayDepth } from "./depth";

test("depth follows (maxX + maxY) * 1000 + maxX", () => {
  expect(footprintDepth(0, 0, 1, 1)).toBe(0);
  expect(footprintDepth(3, 4, 2, 2)).toBe(9_000 + 4);
  expect(footprintDepth(4, 4, 4, 4)).toBe(14_000 + 7);
  expect(footprintDepth(9, 6, 2, 2)).toBeGreaterThan(footprintDepth(4, 4, 4, 4));
  expect(footprintDepth(1, 0, 1, 1)).toBeGreaterThan(footprintDepth(0, 0, 1, 1));
});

test("ground and roads stay below every building and overlays sit half a step in front", () => {
  expect(GROUND_DEPTH).toBeLessThan(ROAD_DEPTH);
  expect(ROAD_DEPTH).toBeLessThan(footprintDepth(0, 0, 1, 1));
  expect(overlayDepth(footprintDepth(2, 3, 2, 2))).toBe(footprintDepth(2, 3, 2, 2) + 0.5);
});
