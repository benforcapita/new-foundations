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

test("points inside a tile invert to that tile, not only the vertex", () => {
  const fractions = [0, 0.25, 0.5, 0.75];
  for (let gy = 0; gy < 96; gy += 1) {
    for (let gx = 0; gx < 96; gx += 1) {
      for (const u of fractions) {
        for (const v of fractions) {
          const dx = gx + u - (gy + v);
          const dy = gx + u + (gy + v);
          expect(screenToGrid(dx * 64, dy * 32)).toEqual({ gx, gy });
        }
      }
    }
  }
});

test("footprint anchor is the bottom grid corner and depth breaks ties", () => {
  expect(getFootprintAnchor(3, 4, 2, 2)).toEqual({ gx: 5, gy: 6 });
  expect(getFootprintAnchor(0, 0, 4, 3)).toEqual({ gx: 4, gy: 3 });
  const cottage = getFootprintAnchor(0, 0, 2, 2);
  expect(gridToScreen(cottage.gx, cottage.gy)).toEqual({ x: (2 - 2) * 64, y: (2 + 2) * 32 });
  expect(getBuildingDepth(0, 0, 2, 2)).toBe((1 + 1) * 1000 + 1);
  expect(getBuildingDepth(0, 4, 1, 1)).not.toBe(getBuildingDepth(4, 0, 1, 1));
  expect(getBuildingDepth(0, 4, 1, 1)).toBe(4 * 1000);
  expect(getBuildingDepth(4, 0, 1, 1)).toBe(4 * 1000 + 4);
  expect(chebyshevFootprints({ x: 5, y: 5, width: 2, height: 2 }, { x: 8, y: 5, width: 1, height: 1 })).toBe(2);
  expect(chebyshevFootprints({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 1 })).toBe(0);
});
