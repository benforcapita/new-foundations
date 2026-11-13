import { expect, test } from "vitest";
import { ROAD, roadNeighborMask, roadSpriteForMask } from "./roadMask";

test("four-neighbor mask sets a bit per orthogonal road", () => {
  const roads = new Set(["1,0", "-1,0", "0,1", "0,-1"]);
  expect(roadNeighborMask(0, 0, roads)).toBe(ROAD.east | ROAD.west | ROAD.south | ROAD.north);
  expect(roadNeighborMask(0, 0, new Set(["1,0"]))).toBe(ROAD.east);
  expect(roadNeighborMask(0, 0, new Set(["0,1", "2,0"]))).toBe(ROAD.south);
});

test("auto-tile picks straight, corner, T, and cross sprites", () => {
  expect(roadSpriteForMask(0)).toEqual({ assetId: "tile_road_straight_ew", flipX: false, flipY: false });
  expect(roadSpriteForMask(ROAD.east | ROAD.west)).toEqual({
    assetId: "tile_road_straight_ew",
    flipX: false,
    flipY: false,
  });
  expect(roadSpriteForMask(ROAD.east)).toEqual({ assetId: "tile_road_straight_ew", flipX: false, flipY: false });
  expect(roadSpriteForMask(ROAD.north | ROAD.south)).toEqual({
    assetId: "tile_road_straight_ns",
    flipX: false,
    flipY: false,
  });
  expect(roadSpriteForMask(ROAD.south)).toEqual({ assetId: "tile_road_straight_ns", flipX: false, flipY: false });

  expect(roadSpriteForMask(ROAD.north | ROAD.east)).toEqual({
    assetId: "tile_road_corner",
    flipX: false,
    flipY: false,
  });
  expect(roadSpriteForMask(ROAD.north | ROAD.west)).toEqual({
    assetId: "tile_road_corner",
    flipX: true,
    flipY: false,
  });
  expect(roadSpriteForMask(ROAD.south | ROAD.east)).toEqual({
    assetId: "tile_road_corner",
    flipX: false,
    flipY: true,
  });
  expect(roadSpriteForMask(ROAD.south | ROAD.west)).toEqual({
    assetId: "tile_road_corner",
    flipX: true,
    flipY: true,
  });

  expect(roadSpriteForMask(ROAD.east | ROAD.west | ROAD.north)).toEqual({
    assetId: "tile_road_t",
    flipX: false,
    flipY: false,
  });
  expect(roadSpriteForMask(ROAD.east | ROAD.west | ROAD.south)).toEqual({
    assetId: "tile_road_t",
    flipX: false,
    flipY: true,
  });
  expect(roadSpriteForMask(ROAD.north | ROAD.south | ROAD.east).assetId).toBe("tile_road_cross");
  expect(roadSpriteForMask(ROAD.north | ROAD.south | ROAD.west).assetId).toBe("tile_road_cross");
  expect(roadSpriteForMask(ROAD.north | ROAD.east | ROAD.south | ROAD.west)).toEqual({
    assetId: "tile_road_cross",
    flipX: false,
    flipY: false,
  });
});
