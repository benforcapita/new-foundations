import { type ContentPhase, type Footprint, type RoadId } from "./ids";

export type RoadDefinition = {
  readonly id: RoadId;
  readonly nameKey: string;
  readonly footprint: Footprint;
  readonly cost: { readonly coins: number };
  readonly buildSeconds: number;
  readonly unlockLevel: number;
  readonly contentPhase: ContentPhase;
  readonly tiles: {
    readonly straightNs: string;
    readonly straightEw: string;
    readonly corner: string;
    readonly t: string;
    readonly cross: string;
  };
};

export const ROAD: RoadDefinition = {
  id: "R-001",
  nameKey: "road.street.name",
  footprint: { width: 1, height: 1 },
  cost: { coins: 0 },
  buildSeconds: 0,
  unlockLevel: 1,
  contentPhase: "p0",
  tiles: {
    straightNs: "tile_road_straight_ns",
    straightEw: "tile_road_straight_ew",
    corner: "tile_road_corner",
    t: "tile_road_t",
    cross: "tile_road_cross",
  },
};
