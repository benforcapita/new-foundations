import { expect, test } from "vitest";
import { buildingById } from "../content/buildings";
import { canPlace, placeableFromBuilding, rotatedFootprint, type PlacementCity, type TerrainKind } from "./canPlace";

function grid(width: number, height: number, terrain: TerrainKind = "grass"): PlacementCity["cells"] {
  const cells = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, y, terrain });
    }
  }
  return cells;
}

function city(patch: Partial<PlacementCity> = {}): PlacementCity {
  const width = patch.width ?? 24;
  const height = patch.height ?? 24;
  return {
    width,
    height,
    level: 15,
    coins: 100_000,
    population: 0,
    populationCap: 500,
    unlockedChunks: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    roads: [],
    ownedCounts: {},
    cells: grid(width, height),
    ...patch,
  };
}

const cottage = placeableFromBuilding(buildingById("B-001"));
const apartments = placeableFromBuilding(buildingById("B-003"));
const school = placeableFromBuilding(buildingById("B-010"));
const station = placeableFromBuilding(buildingById("B-011"));

test("a clear grass plot is placeable and hints for a road", () => {
  const result = canPlace(city(), cottage, 2, 2, 0);
  expect(result).toEqual({ ok: true, reasons: [], roadHint: true });
});

test("an orthogonal road clears the hint without blocking placement", () => {
  const result = canPlace(city({ roads: [{ x: 1, y: 2 }] }), cottage, 2, 2, 0);
  expect(result).toEqual({ ok: true, reasons: [], roadHint: false });
});

test("water, shore, locked chunks, occupancy, level, coins, and population cap are reported together", () => {
  const blocked = city({
    width: 24,
    height: 12,
    level: 1,
    coins: 0,
    population: 50,
    populationCap: 50,
    unlockedChunks: [[0, 0]],
    ownedCounts: { "B-001": 1 },
    cells: grid(24, 12, "water").map((cell) => (cell.x === 12 && cell.y === 0 ? { ...cell, occupantId: "other" } : cell)),
  });
  const result = canPlace(blocked, cottage, 12, 0, 0);
  expect(result.ok).toBe(false);
  expect(result.reasons).toEqual([
    "CHUNK_LOCKED",
    "OCCUPIED",
    "BAD_TERRAIN",
    "INSUFFICIENT_COINS",
    "POP_CAP",
  ]);
});

test("shore is not buildable and plaza and flowering grass are", () => {
  expect(canPlace(city({ cells: grid(24, 24, "shore") }), cottage, 0, 0, 0).reasons).toContain("BAD_TERRAIN");
  expect(canPlace(city({ cells: grid(24, 24, "plaza") }), cottage, 0, 0, 0).ok).toBe(true);
  expect(canPlace(city({ cells: grid(24, 24, "grass_flowers") }), cottage, 0, 0, 0).ok).toBe(true);
});

test("footprints that leave the map are out of bounds", () => {
  expect(canPlace(city(), cottage, -1, 0, 0).reasons).toContain("OUT_OF_BOUNDS");
  expect(canPlace(city(), cottage, 23, 0, 0).reasons).toEqual(["OUT_OF_BOUNDS"]);
  expect(canPlace(city(), cottage, 23, 0, 0).roadHint).toBe(true);
  expect(canPlace(city(), cottage, 30, 30, 0).roadHint).toBe(false);
});

test("moving a building ignores its own footprint", () => {
  const cells = grid(24, 24).map((cell) =>
    cell.x >= 2 && cell.x <= 3 && cell.y >= 2 && cell.y <= 3 ? { ...cell, occupantId: "house-1" } : cell,
  );
  expect(canPlace(city({ cells }), cottage, 2, 2, 0).reasons).toContain("OCCUPIED");
  expect(canPlace(city({ cells }), cottage, 2, 2, 0, "house-1").ok).toBe(true);
});

test("the first cottage is free and apartments wait for level 9", () => {
  expect(canPlace(city({ coins: 0, level: 1 }), cottage, 0, 0, 0).ok).toBe(true);
  expect(canPlace(city({ coins: 0, level: 1, ownedCounts: { "B-001": 1 } }), cottage, 0, 0, 0).reasons).toContain(
    "INSUFFICIENT_COINS",
  );
  expect(canPlace(city({ level: 8 }), apartments, 0, 0, 0).reasons).toEqual(["LOCKED_BY_LEVEL"]);
});

test("civic buildings can be placed at the population cap", () => {
  expect(canPlace(city({ population: 50, populationCap: 50, level: 6 }), school, 0, 0, 0).ok).toBe(true);
});

test("odd rotations swap the 4x3 train station", () => {
  expect(rotatedFootprint(4, 3, 0)).toEqual({ width: 4, height: 3 });
  expect(rotatedFootprint(4, 3, 1)).toEqual({ width: 3, height: 4 });
  expect(rotatedFootprint(4, 3, 2)).toEqual({ width: 4, height: 3 });
  expect(rotatedFootprint(4, 3, 3)).toEqual({ width: 3, height: 4 });
  const narrow = city({ width: 10, height: 10, unlockedChunks: [[0, 0]] });
  expect(canPlace(narrow, station, 7, 0, 0).reasons).toContain("OUT_OF_BOUNDS");
  expect(canPlace(narrow, station, 7, 0, 1).ok).toBe(true);
  expect(canPlace(narrow, station, 7, 0, 3).ok).toBe(true);
});

test("roads occupy a cell, and a road can be placed on grass but not on water", () => {
  const road = {
    id: "R-001",
    category: "road" as const,
    footprint: { width: 1, height: 1 },
    costCoins: 0,
    unlockLevel: 1,
  };
  expect(canPlace(city({ roads: [{ x: 4, y: 4, id: "road-1" }] }), cottage, 4, 4, 0).reasons).toContain("OCCUPIED");
  expect(canPlace(city(), road, 4, 4, 0).ok).toBe(true);
  expect(canPlace(city({ cells: grid(24, 24, "water") }), road, 4, 4, 0).reasons).toContain("BAD_TERRAIN");
  expect(canPlace(city({ roads: [{ x: 4, y: 4, id: "road-1" }] }), road, 4, 4, 0, "road-1").ok).toBe(true);
});

test("a missing cell is bad terrain", () => {
  expect(canPlace(city({ cells: [] }), cottage, 0, 0, 0).reasons).toContain("BAD_TERRAIN");
});
