import { AGRICULTURE, BUILDINGS, DECORATIONS, CHUNK_SIZE, STARTER_MAP, agricultureById, buildingById, rotatedFootprint, type AgricultureId, type BuildingId, type PlacementCity } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import type { DemoBuilding, DemoPlot } from "./demoCity";

export function liveBuildings(snapshot: Snapshot): DemoBuilding[] {
  return snapshot.buildings.filter((b) => BUILDINGS.some((item) => item.id === b.definitionId)).map((b) => ({ instanceId: b.id, buildingId: b.definitionId as BuildingId, x: b.x, y: b.y, rotation: b.rotation, state: b.state, timerLabel: "" }));
}
export function livePlots(snapshot: Snapshot): DemoPlot[] {
  return snapshot.buildings.filter((b) => AGRICULTURE.some((item) => item.id === b.definitionId)).map((b) => ({ instanceId: b.id, plotId: b.definitionId as AgricultureId, x: b.x, y: b.y, ready: b.state === "READY_TO_COLLECT" }));
}
export function livePlacementCity(snapshot: Snapshot): PlacementCity {
  const occupied = new Map<string, string>();
  const ownedCounts: Record<string, number> = {};
  for (const building of snapshot.buildings) {
    const id = building.definitionId;
    const definition = BUILDINGS.some((item) => item.id === id) ? buildingById(id as BuildingId) : AGRICULTURE.some((item) => item.id === id) ? agricultureById(id as AgricultureId) : DECORATIONS.find(d => d.id === id) ?? null;
    if (!definition) continue;
    ownedCounts[id] = (ownedCounts[id] ?? 0) + 1;
    const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, building.rotation);
    for (let y = building.y; y < building.y + footprint.height; y++) for (let x = building.x; x < building.x + footprint.width; x++) occupied.set(`${x},${y}`, building.id);
  }
  const chunks = new Map<string, readonly [number, number]>();
  for (const cell of snapshot.cells) if (cell.ownerClaimed) { const chunk = [Math.floor(cell.x / CHUNK_SIZE), Math.floor(cell.y / CHUNK_SIZE)] as const; chunks.set(chunk.join(","), chunk); }
  return { width: STARTER_MAP.width, height: STARTER_MAP.height, level: snapshot.city.level, coins: snapshot.city.coins, population: snapshot.city.population, populationCap: snapshot.city.populationCap, unlockedChunks: [...chunks.values()], cells: snapshot.cells.map((cell) => ({ x: cell.x, y: cell.y, terrain: cell.terrainId, ...(occupied.has(`${cell.x},${cell.y}`) ? { occupantId: occupied.get(`${cell.x},${cell.y}`) } : {}) })), roads: [], ownedCounts };
}
