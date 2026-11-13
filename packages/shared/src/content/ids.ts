export const BUILDING_IDS = [
  "B-001",
  "B-002",
  "B-003",
  "B-004",
  "B-005",
  "B-006",
  "B-007",
  "B-008",
  "B-009",
  "B-010",
  "B-011",
  "B-012",
] as const;

export type BuildingId = (typeof BUILDING_IDS)[number];

export const AGRICULTURE_IDS = ["AG-001", "AG-002", "AG-003", "AG-004"] as const;

export type AgricultureId = (typeof AGRICULTURE_IDS)[number];

export const GOOD_IDS = [
  "GOOD_WHEAT",
  "GOOD_TIMBER",
  "GOOD_MILK",
  "GOOD_FLOWERS",
  "GOOD_BREAD",
  "GOOD_PLANKS",
  "GOOD_CHEESE",
  "GOOD_PAINT",
  "GOOD_BOOKS",
] as const;

export type GoodId = (typeof GOOD_IDS)[number];

export const RECIPE_IDS = ["RCP-BREAD", "RCP-PLANKS", "RCP-CHEESE", "RCP-PAINT", "RCP-BOOKS"] as const;

export type RecipeId = (typeof RECIPE_IDS)[number];

export const DECORATION_IDS = ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007", "LM-001"] as const;

export type DecorationId = (typeof DECORATION_IDS)[number];

export const ROAD_ID = "R-001" as const;

export type RoadId = typeof ROAD_ID;

export const NPC_IDS = ["NPC-MIA", "NPC-DANA", "NPC-TOM", "NPC-AMIR"] as const;

export type NpcId = (typeof NPC_IDS)[number];

export const NPC_CITY_IDS = ["NPC-CITY-DANA", "NPC-CITY-AMIR"] as const;

export type NpcCityId = (typeof NPC_CITY_IDS)[number];

export const TERRAIN_KINDS = ["grass", "grass_flowers", "plaza", "water", "shore"] as const;

export type TerrainKind = (typeof TERRAIN_KINDS)[number];

export type ContentPhase = "p0" | "p1" | "later";

export type GoodStack = {
  readonly goodId: GoodId;
  readonly qty: number;
};

export type Footprint = {
  readonly width: number;
  readonly height: number;
};

export function byId<T extends { readonly id: string }>(items: readonly T[], id: string, label: string): T {
  const found = items.find((item) => item.id === id);
  if (found === undefined) {
    throw new Error(`unknown ${label} ${id}`);
  }
  return found;
}
