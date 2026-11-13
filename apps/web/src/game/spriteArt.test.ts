import { expect, test } from "vitest";
import { firstOpaqueRow, visibleArtTop } from "./spriteArt";

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
