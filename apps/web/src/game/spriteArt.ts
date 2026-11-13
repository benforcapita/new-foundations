const OPAQUE_ALPHA = 16;

/**
 * A row counts as the roof body once it holds this fraction of the sprite's widest opaque row.
 * Chimney smoke and flagpoles stay under the cut, so a label anchored here cannot float onto the building behind.
 */
const ROOF_BODY_FRACTION = 0.25;

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

/** First source row wide enough to be the roof, ignoring a thin chimney or flagpole above it. */
export function roofBodyRow(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number,
): number {
  let widest = 0;
  const counts: number[] = [];
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > OPAQUE_ALPHA) {
        count += 1;
      }
    }
    counts.push(count);
    if (count > widest) {
      widest = count;
    }
  }
  if (widest === 0) {
    return 0;
  }
  const threshold = widest * ROOF_BODY_FRACTION;
  for (let y = 0; y < counts.length; y += 1) {
    if ((counts[y] ?? 0) >= threshold) {
      return y;
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
