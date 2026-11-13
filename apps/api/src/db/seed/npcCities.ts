import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { CONTENT_VERSION, agricultureById, buildingById } from "@nf/shared";
import type { Database } from "../client";
import { deterministicUuid } from "../ids";
import { buildingCells, buildingInstances, cities, cityCells } from "../schema";

type CellRole = "terrain" | "franchise_plot";

type PlacedBuilding = {
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly state: string;
  readonly outputReady: { goodId: string; qty: number } | Record<string, never>;
};

type NpcCitySpec = {
  readonly npcKey: "dana_city" | "amir_garden";
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly terrainId: string;
  readonly streetY: number;
  readonly plots: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
  readonly buildings: readonly PlacedBuilding[];
  readonly populationCap: number;
};

const DANA_HALL = buildingById("B-009");
const AMIR_WHEAT = agricultureById("AG-001");

if (DANA_HALL.category !== "civic") {
  throw new Error("B-009 must be a civic building");
}

const NPC_CITIES: readonly NpcCitySpec[] = [
  {
    npcKey: "dana_city",
    name: "Dana's City",
    width: 16,
    height: 16,
    terrainId: "grass",
    streetY: 10,
    plots: [
      { x: 12, y: 2, width: 2, height: 2 },
      { x: 12, y: 5, width: 2, height: 2 },
    ],
    buildings: [
      {
        definitionId: "B-009",
        x: 2,
        y: 2,
        state: "ACTIVE",
        outputReady: {},
      },
      {
        definitionId: "B-004",
        x: 8,
        y: 2,
        state: "NEEDS_SUPPLY",
        outputReady: {},
      },
    ],
    populationCap: DANA_HALL.populationCap,
  },
  {
    npcKey: "amir_garden",
    name: "Amir's Garden",
    width: 16,
    height: 16,
    terrainId: "grass_flowers",
    streetY: 8,
    plots: [{ x: 12, y: 2, width: 2, height: 2 }],
    buildings: [
      {
        definitionId: "AG-001",
        x: 2,
        y: 2,
        state: "READY_TO_COLLECT",
        outputReady: { goodId: AMIR_WHEAT.outputGoodId, qty: AMIR_WHEAT.outputQty },
      },
      {
        definitionId: "AG-001",
        x: 6,
        y: 2,
        state: "READY_TO_COLLECT",
        outputReady: { goodId: AMIR_WHEAT.outputGoodId, qty: AMIR_WHEAT.outputQty },
      },
    ],
    populationCap: 0,
  },
];

function footprintOf(definitionId: string): { readonly width: number; readonly height: number } {
  switch (definitionId) {
    case "B-004":
      return buildingById("B-004").footprint;
    case "B-009":
      return buildingById("B-009").footprint;
    case "AG-001":
      return agricultureById("AG-001").footprint;
    default: {
      const unreachable: never = definitionId as never;
      throw new Error(`unknown NPC definition ${String(unreachable)}`);
    }
  }
}

function cellsFor(spec: NpcCitySpec): { x: number; y: number; terrainId: string; cellRole: CellRole }[] {
  const plots = new Set<string>();
  for (const plot of spec.plots) {
    for (let dy = 0; dy < plot.height; dy += 1) {
      for (let dx = 0; dx < plot.width; dx += 1) {
        plots.add(`${plot.x + dx},${plot.y + dy}`);
      }
    }
  }
  const cells: { x: number; y: number; terrainId: string; cellRole: CellRole }[] = [];
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const key = `${x},${y}`;
      cells.push({
        x,
        y,
        terrainId: y === spec.streetY ? "plaza" : spec.terrainId,
        cellRole: plots.has(key) ? "franchise_plot" : "terrain",
      });
    }
  }
  return cells;
}

function assertLayout(spec: NpcCitySpec, cells: readonly { x: number; y: number; cellRole: CellRole }[]): void {
  const occupied = new Set<string>();
  for (const building of spec.buildings) {
    const footprint = footprintOf(building.definitionId);
    for (let dy = 0; dy < footprint.height; dy += 1) {
      for (let dx = 0; dx < footprint.width; dx += 1) {
        const x = building.x + dx;
        const y = building.y + dy;
        const key = `${x},${y}`;
        if (occupied.has(key)) {
          throw new Error(`${spec.npcKey} building ${building.definitionId} overlaps ${key}`);
        }
        occupied.add(key);
        const cell = cells.find((candidate) => candidate.x === x && candidate.y === y);
        if (cell === undefined) {
          throw new Error(`${spec.npcKey} building ${building.definitionId} leaves the map at ${key}`);
        }
        if (cell.cellRole === "franchise_plot") {
          throw new Error(`${spec.npcKey} building ${building.definitionId} covers a franchise host plot at ${key}`);
        }
      }
    }
  }
  if (!cells.some((cell) => cell.cellRole === "franchise_plot")) {
    throw new Error(`${spec.npcKey} is missing franchise host plots`);
  }
}

export async function seedNpcCities(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    for (const spec of NPC_CITIES) {
      const cells = cellsFor(spec);
      assertLayout(spec, cells);
      const cityId = deterministicUuid(spec.npcKey);
      await tx
        .insert(cities)
        .values({
          id: cityId,
          ownerId: null,
          name: spec.name,
          level: 1,
          xp: 0,
          coins: 0,
          gems: 0,
          civicStars: 0,
          version: 1,
          contentVersion: CONTENT_VERSION,
          population: 0,
          populationCap: spec.populationCap,
          warehouseTier: 0,
          warehouseCap: 40,
          isNpc: true,
          npcKey: spec.npcKey,
          tutorialState: null,
          unlockedBounds: [[0, 0]],
          collectPriority: "QUEST_FIRST",
        })
        .onConflictDoUpdate({
          target: cities.npcKey,
          set: {
            name: spec.name,
            isNpc: true,
            populationCap: spec.populationCap,
          },
        });

      await tx.delete(buildingInstances).where(eq(buildingInstances.cityId, cityId));
      await tx.delete(cityCells).where(eq(cityCells.cityId, cityId));
      await tx.insert(cityCells).values(
        cells.map((cell) => ({
          cityId,
          x: cell.x,
          y: cell.y,
          terrainId: cell.terrainId,
          ownerClaimed: true,
          cellRole: cell.cellRole,
        })),
      );
      const placed = spec.buildings.map((building) => ({
        id: randomUUID(),
        building,
      }));
      await tx.insert(buildingInstances).values(
        placed.map(({ id, building }) => ({
          id,
          cityId,
          definitionId: building.definitionId,
          x: building.x,
          y: building.y,
          rotation: 0,
          state: building.state,
          level: 1,
          version: 1,
          outputReady: building.outputReady,
        })),
      );
      await tx.insert(buildingCells).values(
        placed.flatMap(({ id, building }) => {
          const footprint = footprintOf(building.definitionId);
          const covered: { cityId: string; x: number; y: number; buildingId: string }[] = [];
          for (let dy = 0; dy < footprint.height; dy += 1) {
            for (let dx = 0; dx < footprint.width; dx += 1) {
              covered.push({
                cityId,
                x: building.x + dx,
                y: building.y + dy,
                buildingId: id,
              });
            }
          }
          return covered;
        }),
      );
    }
  });
}
