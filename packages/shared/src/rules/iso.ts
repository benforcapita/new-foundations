export const ISO_TILE_WIDTH = 128;
export const ISO_TILE_HEIGHT = 64;

export type GridPoint = {
  readonly gx: number;
  readonly gy: number;
};

export type ScreenPoint = {
  readonly x: number;
  readonly y: number;
};

export type FootprintRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function gridToScreen(gx: number, gy: number, originX = 0, originY = 0): ScreenPoint {
  return {
    x: (gx - gy) * (ISO_TILE_WIDTH / 2) + originX,
    y: (gx + gy) * (ISO_TILE_HEIGHT / 2) + originY,
  };
}

export function screenToGrid(sx: number, sy: number, originX = 0, originY = 0): GridPoint {
  const dx = (sx - originX) / (ISO_TILE_WIDTH / 2);
  const dy = (sy - originY) / (ISO_TILE_HEIGHT / 2);
  return {
    gx: Math.floor((dx + dy) / 2),
    gy: Math.floor((dy - dx) / 2),
  };
}

/** Grid corner (x+w, y+h): the footprint's bottom vertex, one cell past the south tile. */
export function getFootprintAnchor(x: number, y: number, width: number, height: number): GridPoint {
  return { gx: x + width, gy: y + height };
}

/** Painter key. Row sum breaks ties so (0, 4) and (4, 0) do not share a depth. */
export function getBuildingDepth(x: number, y: number, width: number, height: number): number {
  const southX = x + width - 1;
  const southY = y + height - 1;
  return (southX + southY) * 1000 + southX;
}

export function chebyshevFootprints(left: FootprintRect, right: FootprintRect): number {
  let best = Number.POSITIVE_INFINITY;
  for (let y = left.y; y < left.y + left.height; y += 1) {
    for (let x = left.x; x < left.x + left.width; x += 1) {
      for (let otherY = right.y; otherY < right.y + right.height; otherY += 1) {
        for (let otherX = right.x; otherX < right.x + right.width; otherX += 1) {
          const distance = Math.max(Math.abs(x - otherX), Math.abs(y - otherY));
          if (distance < best) {
            best = distance;
          }
        }
      }
    }
  }
  return best;
}
