export const ROAD = {
  east: 1,
  west: 2,
  south: 4,
  north: 8,
} as const;

export type RoadSprite = {
  readonly assetId:
    | "tile_road_straight_ns"
    | "tile_road_straight_ew"
    | "tile_road_corner"
    | "tile_road_t"
    | "tile_road_cross";
  readonly flipX: boolean;
  readonly flipY: boolean;
};

const EAST_WEST = ROAD.east | ROAD.west;
const NORTH_SOUTH = ROAD.north | ROAD.south;

export function roadNeighborMask(x: number, y: number, roads: ReadonlySet<string>): number {
  let mask = 0;
  if (roads.has(`${x + 1},${y}`)) {
    mask |= ROAD.east;
  }
  if (roads.has(`${x - 1},${y}`)) {
    mask |= ROAD.west;
  }
  if (roads.has(`${x},${y + 1}`)) {
    mask |= ROAD.south;
  }
  if (roads.has(`${x},${y - 1}`)) {
    mask |= ROAD.north;
  }
  return mask;
}

function straight(mask: number): RoadSprite {
  if ((mask & NORTH_SOUTH) !== 0 && (mask & EAST_WEST) === 0) {
    return { assetId: "tile_road_straight_ns", flipX: false, flipY: false };
  }
  return { assetId: "tile_road_straight_ew", flipX: false, flipY: false };
}

/** Corner art connects north and east. Flips cover the other three corners. */
function corner(mask: number): RoadSprite {
  return {
    assetId: "tile_road_corner",
    flipX: (mask & ROAD.east) === 0,
    flipY: (mask & ROAD.south) !== 0,
  };
}

/**
 * T art has an east-west bar and a north stem. flipY points the stem south.
 * A north-south bar is not in the placeholder sheet, so those junctions use the cross
 * and keep every real neighbor connected.
 */
function tee(mask: number): RoadSprite {
  const eastWestBar = (mask & ROAD.east) !== 0 && (mask & ROAD.west) !== 0;
  if (eastWestBar) {
    return { assetId: "tile_road_t", flipX: false, flipY: (mask & ROAD.north) === 0 };
  }
  return { assetId: "tile_road_cross", flipX: false, flipY: false };
}

export function roadSpriteForMask(mask: number): RoadSprite {
  const bits = mask & (EAST_WEST | NORTH_SOUTH);
  const horizontal = (bits & EAST_WEST) !== 0;
  const vertical = (bits & NORTH_SOUTH) !== 0;
  if (!horizontal || !vertical) {
    return straight(bits);
  }
  const count = [ROAD.east, ROAD.west, ROAD.south, ROAD.north].filter((bit) => (bits & bit) !== 0).length;
  if (count === 4) {
    return { assetId: "tile_road_cross", flipX: false, flipY: false };
  }
  if (count === 3) {
    return tee(bits);
  }
  return corner(bits);
}
