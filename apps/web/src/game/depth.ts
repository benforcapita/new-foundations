/** Painter's order. Larger values draw in front. Ground stays strictly below buildings. */
export const GROUND_DEPTH = -2_000;
export const ROAD_DEPTH = -1_000;

export function footprintDepth(x: number, y: number, width: number, height: number): number {
  const maxX = x + width - 1;
  const maxY = y + height - 1;
  return (maxX + maxY) * 1000 + maxX;
}

export function overlayDepth(base: number): number {
  return base + 0.5;
}
