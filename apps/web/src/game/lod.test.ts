import { expect, test } from "vitest";
import { LOD_ZOOM_THRESHOLD, districtListSignal, lodMode } from "./lod";

test("zoom below 0.9 collapses overlays and signals the district list", () => {
  expect(LOD_ZOOM_THRESHOLD).toBe(0.9);
  expect(lodMode(1)).toBe("detailed");
  expect(lodMode(0.9)).toBe("detailed");
  expect(lodMode(0.89)).toBe("collapsed");
  expect(lodMode(0.65)).toBe("collapsed");
  expect(districtListSignal(0.89)).toBe(true);
  expect(districtListSignal(0.9)).toBe(false);
});
