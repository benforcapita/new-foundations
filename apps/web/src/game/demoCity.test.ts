import { buildingById, canPlace, placeableFromBuilding } from "@nf/shared";
import { expect, test } from "vitest";
import {
  GHOST_BLOCKED_CELL,
  GHOST_HINT_CLEAR_CELL,
  GHOST_OCCUPIED_CELL,
  GHOST_VALID_CELL,
  demoBuildings,
  demoDepthOrder,
  demoPlacementCity,
  demoPlots,
  demoRoadTiles,
} from "./demoCity";

test("the demo city places town hall behind the grocery and seeds roads, wheat, and ghost cells", () => {
  const city = demoPlacementCity();
  expect(city.width).toBe(24);
  expect(city.height).toBe(24);
  expect(demoBuildings().find((building) => building.instanceId === "town-hall")).toMatchObject({
    buildingId: "B-009",
    x: 4,
    y: 4,
    state: "ACTIVE",
  });
  expect(demoBuildings().map((building) => building.state)).toEqual([
    "UNDER_CONSTRUCTION",
    "ACTIVE",
    "NEEDS_SUPPLY",
    "PRODUCING",
    "READY_TO_COLLECT",
  ]);
  const depthOf = (id: string): number => {
    const item = demoDepthOrder().find((entry) => entry.id === id);
    expect(item).toBeDefined();
    return item?.depth ?? 0;
  };
  expect(depthOf("grocery")).toBeGreaterThan(depthOf("town-hall"));
  expect(depthOf("cottage-build")).toBeLessThan(depthOf("town-hall"));
  expect(demoPlots().filter((plot) => plot.plotId === "AG-001" && plot.ready)).toHaveLength(1);
  expect(demoPlots().filter((plot) => plot.plotId === "AG-001" && !plot.ready)).toHaveLength(1);

  const cottage = placeableFromBuilding(buildingById("B-001"));
  expect(canPlace(city, cottage, GHOST_VALID_CELL.x, GHOST_VALID_CELL.y, 0)).toMatchObject({
    ok: true,
    roadHint: true,
  });
  expect(canPlace(city, cottage, GHOST_HINT_CLEAR_CELL.x, GHOST_HINT_CLEAR_CELL.y, 0)).toMatchObject({
    ok: true,
    roadHint: false,
  });
  expect(canPlace(city, cottage, GHOST_BLOCKED_CELL.x, GHOST_BLOCKED_CELL.y, 0).reasons).toEqual(["BAD_TERRAIN"]);
  expect(canPlace(city, cottage, GHOST_OCCUPIED_CELL.x, GHOST_OCCUPIED_CELL.y, 0).reasons).toContain("OCCUPIED");

  const tiles = demoRoadTiles();
  expect(tiles.find((tile) => tile.x === 8 && tile.y === 8)?.sprite.assetId).toBe("tile_road_cross");
  expect(tiles.find((tile) => tile.x === 12 && tile.y === 8)?.sprite).toEqual({
    assetId: "tile_road_t",
    flipX: false,
    flipY: false,
  });
  expect(tiles.find((tile) => tile.x === 16 && tile.y === 8)?.sprite).toEqual({
    assetId: "tile_road_corner",
    flipX: true,
    flipY: true,
  });
});
