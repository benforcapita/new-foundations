const OPAQUE_ALPHA = 16;

/** First source row that contains a visible texel. Transparent padding above the roof is skipped. */
export function firstOpaqueRow(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number,
): number {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > OPAQUE_ALPHA) {
        return y;
      }
    }
  }
  return 0;
}

/** Screen Y of the visible roof. `anchorY` is the footprint bottom, and `originY` is the Phaser origin. */
export function visibleArtTop(
  anchorY: number,
  displayHeight: number,
  originY: number,
  sourceHeight: number,
  opaqueRow: number,
): number {
  const frameTop = anchorY - displayHeight * originY;
  if (sourceHeight <= 0) {
    return frameTop;
  }
  return frameTop + displayHeight * (opaqueRow / sourceHeight);
}
