import starterJson from "./maps/starter_24.json" with { type: "json" };
import { TERRAIN_KINDS, type TerrainKind } from "./ids";

export type StarterMap = {
  readonly id: "starter_24";
  readonly width: 24;
  readonly height: 24;
  readonly chunkSize: 12;
  readonly chunks: readonly (readonly [number, number])[];
  readonly townHall: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly rows: readonly (readonly TerrainKind[])[];
};

export const TERRAIN_ASSETS: Readonly<Record<TerrainKind, string>> = {
  grass: "tile_grass",
  grass_flowers: "tile_grass_flowers",
  plaza: "tile_plaza",
  water: "tile_water",
  shore: "tile_shore",
};

const STARTER_CHUNKS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

function isTerrain(value: unknown): value is TerrainKind {
  return typeof value === "string" && (TERRAIN_KINDS as readonly string[]).includes(value);
}

function isChunkList(value: unknown): value is readonly (readonly [number, number])[] {
  if (!Array.isArray(value) || value.length !== STARTER_CHUNKS.length) {
    return false;
  }
  return value.every((chunk, index) => {
    const expected = STARTER_CHUNKS[index];
    return (
      expected !== undefined &&
      Array.isArray(chunk) &&
      chunk.length === 2 &&
      chunk[0] === expected[0] &&
      chunk[1] === expected[1]
    );
  });
}

export function parseStarterMap(value: unknown): StarterMap {
  if (typeof value !== "object" || value === null) {
    throw new Error("starter map must be an object");
  }
  const record = value as Record<string, unknown>;
  if (record.id !== "starter_24" || record.width !== 24 || record.height !== 24 || record.chunkSize !== 12) {
    throw new Error("starter map must be 24x24 with chunk size 12");
  }
  if (!isChunkList(record.chunks)) {
    throw new Error("starter map chunks must be (0,0), (1,0), (0,1), (1,1)");
  }
  const hall = record.townHall;
  if (
    typeof hall !== "object" ||
    hall === null ||
    (hall as { x?: unknown }).x !== 4 ||
    (hall as { y?: unknown }).y !== 4 ||
    (hall as { width?: unknown }).width !== 4 ||
    (hall as { height?: unknown }).height !== 4
  ) {
    throw new Error("starter map town hall anchor must be a 4x4 at (4,4)");
  }
  if (!Array.isArray(record.rows) || record.rows.length !== 24) {
    throw new Error("starter map must have 24 rows");
  }
  const rows = record.rows.map((row, y) => {
    if (!Array.isArray(row) || row.length !== 24) {
      throw new Error(`starter map row ${y} must have 24 cells`);
    }
    return row.map((cell, x) => {
      if (!isTerrain(cell)) {
        throw new Error(`starter map cell ${x},${y} has unknown terrain`);
      }
      return cell;
    });
  });
  return {
    id: "starter_24",
    width: 24,
    height: 24,
    chunkSize: 12,
    chunks: STARTER_CHUNKS,
    townHall: { x: 4, y: 4, width: 4, height: 4 },
    rows,
  };
}

export const STARTER_MAP: StarterMap = parseStarterMap(starterJson);
