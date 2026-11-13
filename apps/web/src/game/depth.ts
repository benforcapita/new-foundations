import { getBuildingDepth } from "@nf/shared";

/** Painter's order. Larger values draw in front. Ground stays strictly below buildings. */
export const GROUND_DEPTH = -2_000;
export const ROAD_DEPTH = -1_000;

/** Shared painter key: (maxX + maxY) * 1000 + maxX, with max = origin + size - 1. */
export function footprintDepth(x: number, y: number, width: number, height: number): number {
  return getBuildingDepth(x, y, width, height);
}

export function overlayDepth(base: number): number {
  return base + 0.5;
}
