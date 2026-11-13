import { ISO_TILE_WIDTH, gridToScreen } from "@nf/shared";

type ScreenPoint = ReturnType<typeof gridToScreen>;

/** Shifts the 24×24 diamond into positive screen space. */
export const MAP_ORIGIN_X = 24 * (ISO_TILE_WIDTH / 2);
export const MAP_ORIGIN_Y = 80;

export function anchorScreen(x: number, y: number, width: number, height: number): ScreenPoint {
  return gridToScreen(x + width, y + height, MAP_ORIGIN_X, MAP_ORIGIN_Y);
}

export function footprintCenter(x: number, y: number, width: number, height: number): ScreenPoint {
  return gridToScreen(x + width / 2, y + height / 2, MAP_ORIGIN_X, MAP_ORIGIN_Y);
}

export function cellCenter(x: number, y: number): ScreenPoint {
  return gridToScreen(x + 0.5, y + 0.5, MAP_ORIGIN_X, MAP_ORIGIN_Y);
}

export function diamondPoints(x: number, y: number, width: number, height: number): readonly ScreenPoint[] {
  return [
    gridToScreen(x, y, MAP_ORIGIN_X, MAP_ORIGIN_Y),
    gridToScreen(x + width, y, MAP_ORIGIN_X, MAP_ORIGIN_Y),
    gridToScreen(x + width, y + height, MAP_ORIGIN_X, MAP_ORIGIN_Y),
    gridToScreen(x, y + height, MAP_ORIGIN_X, MAP_ORIGIN_Y),
  ];
}

export function displaySize(
  width: number,
  height: number,
  scale: number,
  aspect: number,
): { readonly width: number; readonly height: number } {
  const displayWidth = (width + height) * (ISO_TILE_WIDTH / 2) * scale;
  return { width: displayWidth, height: displayWidth * aspect };
}
