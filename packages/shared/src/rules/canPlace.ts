import type { BuildingDefinition } from "../content/buildings";
import type { TerrainKind } from "../content/ids";
import { CHUNK_SIZE } from "./economy";

export type { TerrainKind } from "../content/ids";

export type QuarterTurns = 0 | 1 | 2 | 3;

export type PlaceReason =
  | "OUT_OF_BOUNDS"
  | "CHUNK_LOCKED"
  | "OCCUPIED"
  | "BAD_TERRAIN"
  | "LOCKED_BY_LEVEL"
  | "INSUFFICIENT_COINS"
  | "POP_CAP";

export type PlaceResult = {
  readonly ok: boolean;
  readonly reasons: readonly PlaceReason[];
  /** True when no orthogonal road touches the footprint, so the client can draw the optional road hint. */
  readonly roadHint: boolean;
};

export type PlaceCell = {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainKind;
  readonly occupantId?: string;
};

export type RoadCell = {
  readonly x: number;
  readonly y: number;
  readonly id?: string;
};

export type PlaceableDefinition = {
  readonly id: string;
  readonly category:
    | BuildingDefinition["category"]
    | "agriculture"
    | "road";
  readonly footprint: { readonly width: number; readonly height: number };
  readonly costCoins: number;
  readonly unlockLevel: number;
  readonly population?: number;
  readonly firstFree?: boolean;
};

export type PlacementCity = {
  readonly width: number;
  readonly height: number;
  readonly level: number;
  readonly coins: number;
  readonly population: number;
  readonly populationCap: number;
  readonly unlockedChunks: readonly (readonly [number, number])[];
  readonly cells: readonly PlaceCell[];
  readonly roads: readonly RoadCell[];
  readonly ownedCounts?: Readonly<Record<string, number>>;
};

const REASON_ORDER: readonly PlaceReason[] = [
  "OUT_OF_BOUNDS",
  "CHUNK_LOCKED",
  "OCCUPIED",
  "BAD_TERRAIN",
  "LOCKED_BY_LEVEL",
  "INSUFFICIENT_COINS",
  "POP_CAP",
];

const BUILDABLE: ReadonlySet<TerrainKind> = new Set(["grass", "grass_flowers", "plaza"]);

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function rotatedFootprint(
  width: number,
  height: number,
  rotation: QuarterTurns,
): { readonly width: number; readonly height: number } {
  if (rotation === 1 || rotation === 3) {
    return { width: height, height: width };
  }
  return { width, height };
}

export function placeableFromBuilding(building: BuildingDefinition): PlaceableDefinition {
  return {
    id: building.id,
    category: building.category,
    footprint: building.footprint,
    costCoins: building.cost.coins,
    unlockLevel: building.unlockLevel,
    population: building.category === "residential" ? building.population : undefined,
    firstFree: building.firstFree,
  };
}

function chunkUnlocked(city: PlacementCity, x: number, y: number): boolean {
  const chunkX = Math.floor(x / CHUNK_SIZE);
  const chunkY = Math.floor(y / CHUNK_SIZE);
  return city.unlockedChunks.some(([unlockedX, unlockedY]) => unlockedX === chunkX && unlockedY === chunkY);
}

function showRoadHint(cells: readonly { readonly x: number; readonly y: number }[], roads: ReadonlySet<string>): boolean {
  if (cells.length === 0) {
    return false;
  }
  const inside = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  for (const cell of cells) {
    for (const [dx, dy] of ORTHOGONAL) {
      const neighbor = `${cell.x + dx},${cell.y + dy}`;
      if (!inside.has(neighbor) && roads.has(neighbor)) {
        return false;
      }
    }
  }
  return true;
}

export function canPlace(
  city: PlacementCity,
  definition: PlaceableDefinition,
  x: number,
  y: number,
  rotation: QuarterTurns,
  ignoreInstanceId?: string,
): PlaceResult {
  const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, rotation);
  const reasons = new Set<PlaceReason>();
  const cellByKey = new Map(city.cells.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const roadKeys = new Set(
    city.roads
      .filter((road) => road.id === undefined || road.id !== ignoreInstanceId)
      .map((road) => `${road.x},${road.y}`),
  );
  const inside: { x: number; y: number }[] = [];

  for (let dy = 0; dy < footprint.height; dy += 1) {
    for (let dx = 0; dx < footprint.width; dx += 1) {
      const cellX = x + dx;
      const cellY = y + dy;
      if (cellX < 0 || cellY < 0 || cellX >= city.width || cellY >= city.height) {
        reasons.add("OUT_OF_BOUNDS");
        continue;
      }
      inside.push({ x: cellX, y: cellY });
      if (!chunkUnlocked(city, cellX, cellY)) {
        reasons.add("CHUNK_LOCKED");
      }
      const key = `${cellX},${cellY}`;
      if (roadKeys.has(key)) {
        reasons.add("OCCUPIED");
      }
      const cell = cellByKey.get(key);
      if (cell === undefined || !BUILDABLE.has(cell.terrain)) {
        reasons.add("BAD_TERRAIN");
      }
      if (cell?.occupantId !== undefined && cell.occupantId !== ignoreInstanceId) {
        reasons.add("OCCUPIED");
      }
    }
  }

  if (city.level < definition.unlockLevel) {
    reasons.add("LOCKED_BY_LEVEL");
  }
  const owned = city.ownedCounts?.[definition.id] ?? 0;
  const cost = definition.firstFree === true && owned === 0 ? 0 : definition.costCoins;
  if (city.coins < cost) {
    reasons.add("INSUFFICIENT_COINS");
  }
  if (definition.category === "residential") {
    const added = definition.population ?? 0;
    if (city.population + added > city.populationCap) {
      reasons.add("POP_CAP");
    }
  }

  return {
    ok: reasons.size === 0,
    reasons: REASON_ORDER.filter((reason) => reasons.has(reason)),
    roadHint: showRoadHint(inside, roadKeys),
  };
}
