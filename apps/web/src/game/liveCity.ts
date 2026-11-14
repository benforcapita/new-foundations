import { AGRICULTURE, BUILDINGS, DECORATIONS, CHUNK_SIZE, STARTER_MAP, agricultureById, buildingById, rotatedFootprint, decorationBoostFor, roadBonusFor, businessReward, type AgricultureId, type BuildingId, type PlacementCity } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import { roadNeighborMask, roadSpriteForMask } from "./roadMask";
import type { DemoBuilding, DemoPlot } from "./demoCity";

export function liveBuildings(snapshot: Snapshot): DemoBuilding[] {
  return snapshot.buildings.filter((b) => BUILDINGS.some((item) => item.id === b.definitionId)).map((b) => ({ instanceId: b.id, buildingId: b.definitionId as BuildingId, x: b.x, y: b.y, rotation: b.rotation, state: b.state, timerLabel: "" }));
}
export function livePlots(snapshot: Snapshot): DemoPlot[] {
  return snapshot.buildings.filter((b) => AGRICULTURE.some((item) => item.id === b.definitionId)).map((b) => ({ instanceId: b.id, plotId: b.definitionId as AgricultureId, x: b.x, y: b.y, ready: b.state === "READY_TO_COLLECT" }));
}
export function liveRoadTiles(snapshot: Snapshot) {
  const roads = snapshot.buildings.filter(b => b.definitionId === "R-001").map(b => ({ id: b.id, x: b.x, y: b.y }));
  const keys = new Set(roads.map(r => `${r.x},${r.y}`));
  return roads.map(road => ({ ...road, sprite: roadSpriteForMask(roadNeighborMask(road.x, road.y, keys)) }));
}
export function livePlacementCity(snapshot: Snapshot): PlacementCity {
  const occupied = new Map<string, string>();
  const ownedCounts = { ...snapshot.city.placedCounts };
  for (const building of snapshot.buildings) {
    const id = building.definitionId;
    const definition = BUILDINGS.some((item) => item.id === id) ? buildingById(id as BuildingId) : AGRICULTURE.some((item) => item.id === id) ? agricultureById(id as AgricultureId) : DECORATIONS.find(d => d.id === id) ?? null;
    if (!definition) continue;
    const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, building.rotation);
    for (let y = building.y; y < building.y + footprint.height; y++) for (let x = building.x; x < building.x + footprint.width; x++) occupied.set(`${x},${y}`, building.id);
  }
  const chunks = new Map<string, readonly [number, number]>();
  for (const cell of snapshot.cells) if (cell.ownerClaimed) { const chunk = [Math.floor(cell.x / CHUNK_SIZE), Math.floor(cell.y / CHUNK_SIZE)] as const; chunks.set(chunk.join(","), chunk); }
  return { width: STARTER_MAP.width, height: STARTER_MAP.height, level: snapshot.city.level, coins: snapshot.city.coins, population: snapshot.city.population, populationCap: snapshot.city.populationCap, unlockedChunks: [...chunks.values()], cells: snapshot.cells.map((cell) => ({ x: cell.x, y: cell.y, terrain: cell.terrainId, ...(occupied.has(`${cell.x},${cell.y}`) ? { occupantId: occupied.get(`${cell.x},${cell.y}`) } : {}) })), roads: liveRoadTiles(snapshot).map(({ id, x, y }) => ({ id, x, y })), ownedCounts };
}

export function liveBusinessModifiers(building: Snapshot["buildings"][number], buildings: Snapshot["buildings"]) {
  const definition = BUILDINGS.find(b => b.id === building.definitionId && b.category === "commercial");
  if (!definition || definition.category !== "commercial") return null;
  const size = rotatedFootprint(definition.footprint.width, definition.footprint.height, building.rotation);
  const footprint = { x: building.x, y: building.y, ...size };
  const decorations = buildings.flatMap(other => {
    const deco = DECORATIONS.find(d => d.id === other.definitionId);
    const park = BUILDINGS.find(d => d.id === other.definitionId && d.category === "decoration");
    if (!deco && (!park || park.category !== "decoration")) return [];
    const source = deco ?? park;
    if (!source) return [];
    const dimensions = rotatedFootprint(source.footprint.width, source.footprint.height, other.rotation);
    return [{ definitionId: other.definitionId, x: other.x, y: other.y, ...dimensions, bonus: deco ? deco.boost : park?.category === "decoration" ? park.boost : 0, radius: deco ? deco.radius : park?.category === "decoration" ? park.boostRadius : 0 }];
  });
  const decorationBoost = decorationBoostFor(footprint, decorations);
  const roadBonus = roadBonusFor(footprint, buildings.filter(b => b.definitionId === "R-001"));
  return { decorationBoost, roadBonus, reward: businessReward({ baseCoins: definition.coinYield, level: building.level, decorationBoost, roadBonus }) };
}

export function decorationPreview(buildings: Snapshot["buildings"], definitionId: string, x: number, y: number, rotation: 0 | 1 | 2 | 3) {
  const candidate = { id: "preview", definitionId, x, y, rotation } as Snapshot["buildings"][number];
  return buildings.flatMap(building => {
    const before = liveBusinessModifiers(building, buildings);
    const after = liveBusinessModifiers(building, [...buildings, candidate]);
    const boost = Math.round(((after?.decorationBoost ?? 0) - (before?.decorationBoost ?? 0)) * 100) / 100;
    return boost > 0 ? [{ id: building.id, x: building.x, y: building.y, boost }] : [];
  });
}
