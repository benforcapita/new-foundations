import {
  STARTER_MAP,
  agricultureById,
  buildingById,
  placeableFromBuilding,
  rotatedFootprint,
  type AgricultureId,
  type BuildingId,
  type BuildingState,
  type PlacementCity,
  type QuarterTurns,
  type TerrainKind,
} from "@nf/shared";
import { footprintDepth } from "./depth";
import { roadNeighborMask, roadSpriteForMask, type RoadSprite } from "./roadMask";

export type DemoBuilding = {
  readonly instanceId: string;
  readonly buildingId: BuildingId;
  readonly x: number;
  readonly y: number;
  readonly rotation: QuarterTurns;
  readonly state: BuildingState;
  readonly timerLabel: string;
};

export type DemoPlot = {
  readonly instanceId: string;
  readonly plotId: AgricultureId;
  readonly x: number;
  readonly y: number;
  readonly ready: boolean;
};

export type DemoRoad = {
  readonly x: number;
  readonly y: number;
};

export const GHOST_VALID_CELL = { x: 0, y: 18 } as const;
export const GHOST_HINT_CLEAR_CELL = { x: 0, y: 6 } as const;
export const GHOST_BLOCKED_CELL = { x: 22, y: 5 } as const;
export const GHOST_OCCUPIED_CELL = { x: 4, y: 4 } as const;

const BUILDINGS: readonly DemoBuilding[] = [
  {
    instanceId: "cottage-build",
    buildingId: "B-001",
    x: 1,
    y: 1,
    rotation: 0,
    state: "UNDER_CONSTRUCTION",
    timerLabel: "",
  },
  {
    instanceId: "town-hall",
    buildingId: "B-009",
    x: 4,
    y: 4,
    rotation: 0,
    state: "ACTIVE",
    timerLabel: "",
  },
  {
    instanceId: "grocery",
    buildingId: "B-004",
    x: 9,
    y: 6,
    rotation: 0,
    state: "NEEDS_SUPPLY",
    timerLabel: "",
  },
  {
    instanceId: "bakery",
    buildingId: "B-007",
    x: 9,
    y: 9,
    rotation: 0,
    state: "PRODUCING",
    timerLabel: "3:00",
  },
  {
    instanceId: "cottage-ready",
    buildingId: "B-001",
    x: 12,
    y: 12,
    rotation: 0,
    state: "READY_TO_COLLECT",
    timerLabel: "",
  },
];

const PLOTS: readonly DemoPlot[] = [
  { instanceId: "wheat-ready", plotId: "AG-001", x: 14, y: 14, ready: true },
  { instanceId: "wheat-growing", plotId: "AG-001", x: 18, y: 14, ready: false },
];

function line(x0: number, y0: number, x1: number, y1: number): DemoRoad[] {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  const cells: DemoRoad[] = [];
  for (let step = 0; step <= steps; step += 1) {
    cells.push({ x: x0 + dx * step, y: y0 + dy * step });
  }
  return cells;
}

function uniqueRoads(cells: readonly DemoRoad[]): DemoRoad[] {
  const seen = new Set<string>();
  const roads: DemoRoad[] = [];
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    roads.push(cell);
  }
  return roads;
}

const ROADS: readonly DemoRoad[] = uniqueRoads([
  ...line(0, 8, 16, 8),
  ...line(8, 0, 8, 16),
  ...line(12, 8, 12, 7),
  ...line(16, 8, 16, 9),
]);

export function demoBuildings(): readonly DemoBuilding[] {
  return BUILDINGS;
}

export function demoPlots(): readonly DemoPlot[] {
  return PLOTS;
}

export function demoRoads(): readonly DemoRoad[] {
  return ROADS;
}

export function demoRoadTiles(): readonly { x: number; y: number; mask: number; sprite: RoadSprite }[] {
  const keys = new Set(ROADS.map((road) => `${road.x},${road.y}`));
  return ROADS.map((road) => {
    const mask = roadNeighborMask(road.x, road.y, keys);
    return { x: road.x, y: road.y, mask, sprite: roadSpriteForMask(mask) };
  });
}

export type DepthItem = {
  readonly id: string;
  readonly depth: number;
};

export function demoDepthOrder(): readonly DepthItem[] {
  const buildings = BUILDINGS.map((building) => {
    const definition = buildingById(building.buildingId);
    const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, building.rotation);
    return {
      id: building.instanceId,
      depth: footprintDepth(building.x, building.y, footprint.width, footprint.height),
    };
  });
  const plots = PLOTS.map((plot) => {
    const definition = agricultureById(plot.plotId);
    return {
      id: plot.instanceId,
      depth: footprintDepth(plot.x, plot.y, definition.footprint.width, definition.footprint.height),
    };
  });
  return [...buildings, ...plots].sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id));
}

function terrainAt(x: number, y: number): TerrainKind {
  const row = STARTER_MAP.rows[y];
  const terrain = row?.[x];
  if (terrain === undefined) {
    throw new Error(`starter map is missing terrain at ${x},${y}`);
  }
  return terrain;
}

function occupy(
  occupied: Map<string, string>,
  x: number,
  y: number,
  width: number,
  height: number,
  id: string,
): void {
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const key = `${x + dx},${y + dy}`;
      const existing = occupied.get(key);
      if (existing !== undefined) {
        throw new Error(`${id} overlaps ${existing} at ${key}`);
      }
      occupied.set(key, id);
    }
  }
}

let cachedCity: PlacementCity | null = null;

export function demoPlacementCity(): PlacementCity {
  if (cachedCity !== null) {
    return cachedCity;
  }
  const occupied = new Map<string, string>();
  for (const building of BUILDINGS) {
    const definition = buildingById(building.buildingId);
    const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, building.rotation);
    occupy(occupied, building.x, building.y, footprint.width, footprint.height, building.instanceId);
  }
  for (const plot of PLOTS) {
    const definition = agricultureById(plot.plotId);
    occupy(occupied, plot.x, plot.y, definition.footprint.width, definition.footprint.height, plot.instanceId);
  }
  for (const road of ROADS) {
    const key = `${road.x},${road.y}`;
    const existing = occupied.get(key);
    if (existing !== undefined) {
      throw new Error(`road overlaps ${existing} at ${key}`);
    }
  }
  const cells = [];
  for (let y = 0; y < STARTER_MAP.height; y += 1) {
    for (let x = 0; x < STARTER_MAP.width; x += 1) {
      const occupantId = occupied.get(`${x},${y}`);
      cells.push({
        x,
        y,
        terrain: terrainAt(x, y),
        ...(occupantId === undefined ? {} : { occupantId }),
      });
    }
  }
  cachedCity = {
    width: STARTER_MAP.width,
    height: STARTER_MAP.height,
    level: 15,
    coins: 100_000,
    population: 16,
    populationCap: 200,
    unlockedChunks: STARTER_MAP.chunks,
    cells,
    roads: ROADS,
    ownedCounts: { "B-001": 2, "B-004": 1, "B-007": 1, "B-009": 1 },
  };
  return cachedCity;
}

export function placeableBuilding(id: BuildingId) {
  return placeableFromBuilding(buildingById(id));
}
