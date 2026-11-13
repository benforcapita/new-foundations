import { expect, test } from "vitest";
import { chebyshevFootprints, getBuildingDepth, getFootprintAnchor, gridToScreen, screenToGrid } from "./iso";

test("screen projection and its inverse agree on every 96x96 cell", () => {
  const origins = [
    { x: 0, y: 0 },
    { x: 640, y: 320 },
  ];
  for (const origin of origins) {
    for (let gy = 0; gy < 96; gy += 1) {
      for (let gx = 0; gx < 96; gx += 1) {
        const screen = gridToScreen(gx, gy, origin.x, origin.y);
        expect(screen).toEqual({
          x: (gx - gy) * 64 + origin.x,
          y: (gx + gy) * 32 + origin.y,
        });
        expect(screenToGrid(screen.x, screen.y, origin.x, origin.y)).toEqual({ gx, gy });
      }
    }
  }
});

test("footprint anchor is the south corner and depth follows it", () => {
  expect(getFootprintAnchor(3, 4, 2, 2)).toEqual({ gx: 4, gy: 5 });
  expect(getFootprintAnchor(0, 0, 4, 3)).toEqual({ gx: 3, gy: 2 });
  expect(getBuildingDepth(0, 0, 2, 2)).toBe(2);
  expect(getBuildingDepth(1, 0, 1, 1)).toBeGreaterThan(getBuildingDepth(0, 0, 1, 1));
  expect(getBuildingDepth(0, 2, 1, 1)).toBeGreaterThan(getBuildingDepth(0, 1, 1, 1));
  expect(chebyshevFootprints({ x: 5, y: 5, width: 2, height: 2 }, { x: 8, y: 5, width: 1, height: 1 })).toBe(2);
  expect(chebyshevFootprints({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 1 })).toBe(0);
});
