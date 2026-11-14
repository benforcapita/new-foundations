import { expect, it } from "vitest";
import type { Snapshot } from "@nf/shared/schemas";
import { livePlacementCity, liveRoadTiles } from "./liveCity";

it("includes live roads in placement and tiles their neighbours", () => {
  const snapshot = { city: { level: 1, coins: 0, population: 0, populationCap: 50, placedCounts: {} }, cells: [], buildings: [
    { id: "a", definitionId: "R-001", x: 2, y: 3, rotation: 0 },
    { id: "b", definitionId: "R-001", x: 2, y: 4, rotation: 0 },
  ] } as unknown as Snapshot;
  expect(livePlacementCity(snapshot).roads).toEqual([{ id: "a", x: 2, y: 3 }, { id: "b", x: 2, y: 4 }]);
  expect(liveRoadTiles(snapshot).map(r => r.sprite.assetId)).toEqual(["tile_road_straight_ns", "tile_road_straight_ns"]);
});

it("computes the same business modifiers from live decorations and roads", async () => {
  const { liveBusinessModifiers } = await import("./liveCity");
  const buildings = [
    { id: "shop", definitionId: "B-004", x: 4, y: 4, rotation: 0, level: 1 },
    { id: "tree", definitionId: "D-001", x: 3, y: 3, rotation: 0 },
    { id: "tree2", definitionId: "D-001", x: 2, y: 3, rotation: 0 },
    { id: "road", definitionId: "R-001", x: 3, y: 4, rotation: 0 },
  ] as Snapshot["buildings"];
  const shop = buildings[0];
  if (!shop) throw new Error("Missing shop");
  expect(liveBusinessModifiers(shop, buildings)).toEqual({ decorationBoost: 0.01, roadBonus: 0.05, reward: 116 });
});

it("reports the incremental boost for nearby businesses in a decoration preview", async () => {
  const { decorationPreview } = await import("./liveCity");
  const buildings = [{ id: "shop", definitionId: "B-004", x: 4, y: 4, rotation: 0, level: 1 }] as Snapshot["buildings"];
  expect(decorationPreview(buildings, "D-001", 3, 3, 0)).toEqual([{ id: "shop", x: 4, y: 4, boost: 0.01 }]);
  expect(decorationPreview(buildings, "D-001", 0, 0, 0)).toEqual([]);
});
