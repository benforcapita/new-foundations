import { expect, test } from "vitest";
import { firstOpaqueRow, roofBodyRow, visibleArtTop } from "./spriteArt";

test("the first opaque row skips transparent padding above the art", () => {
  const width = 4;
  const height = 4;
  const alpha = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 200, 0],
    [255, 255, 255, 255],
  ];
  expect(firstOpaqueRow(width, height, (x, y) => alpha[y]?.[x] ?? 0)).toBe(2);
  expect(firstOpaqueRow(2, 2, () => 0)).toBe(0);
});

test("a thin chimney does not pull the label above the roof body", () => {
  const width = 20;
  const height = 10;
  const alphaAt = (x: number, y: number): number => {
    if (y < 6 && x >= 9 && x <= 10) {
      return 255;
    }
    if (y >= 6) {
      return 255;
    }
    return 0;
  };
  expect(firstOpaqueRow(width, height, alphaAt)).toBe(0);
  expect(roofBodyRow(width, height, alphaAt)).toBe(6);
  expect(roofBodyRow(2, 2, () => 0)).toBe(0);
});

test("status labels sit on the visible roof, not the top of the padded frame", () => {
  const anchorY = 272;
  const displayHeight = 256;
  const sourceHeight = 512;
  const opaqueRow = 199;
  const artTop = visibleArtTop(anchorY, displayHeight, 1, sourceHeight, opaqueRow);
  const frameTop = anchorY - displayHeight;
  expect(artTop).toBeCloseTo(frameTop + displayHeight * (199 / 512));
  expect(frameTop - artTop).toBeCloseTo(-99.5);
  expect(visibleArtTop(anchorY, displayHeight, 1, 0, 10)).toBe(frameTop);
});
