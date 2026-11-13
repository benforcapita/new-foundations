import { LANDMARK_DECORATION, STREET_DECORATION } from "./boosts";
import { byId, type ContentPhase, type DecorationId, type Footprint } from "./ids";

export type DecorationDefinition = {
  readonly id: DecorationId;
  readonly nameKey: string;
  readonly footprint: Footprint;
  readonly cost: { readonly coins: number };
  readonly buildSeconds: number;
  readonly unlockLevel: number;
  readonly boost: number;
  readonly radius: number;
  readonly contentPhase: ContentPhase;
  readonly assetId?: string;
  readonly parts?: readonly {
    readonly assetId: string;
    readonly role: "ground" | "centre" | "lamp";
    readonly count: number;
  }[];
};

export const DECORATIONS: readonly DecorationDefinition[] = [
  {
    id: "D-001",
    nameKey: "decoration.oak.name",
    assetId: "deco_tree_oak",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p0",
  },
  {
    id: "D-002",
    nameKey: "decoration.spring.name",
    assetId: "deco_tree_spring",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p1",
  },
  {
    id: "D-003",
    nameKey: "decoration.bench.name",
    assetId: "deco_bench",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p1",
  },
  {
    id: "D-004",
    nameKey: "decoration.lamp.name",
    assetId: "deco_lamp",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p1",
  },
  {
    id: "D-005",
    nameKey: "decoration.planter.name",
    assetId: "deco_planter",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p1",
  },
  {
    id: "D-006",
    nameKey: "decoration.fountain.name",
    assetId: "deco_fountain",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p1",
  },
  {
    id: "D-007",
    nameKey: "decoration.flowers.name",
    assetId: "deco_flower_patch",
    footprint: { width: 1, height: 1 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 4,
    boost: STREET_DECORATION.boost,
    radius: STREET_DECORATION.radius,
    contentPhase: "p1",
  },
  {
    id: "LM-001",
    nameKey: "decoration.landmark.name",
    footprint: { width: 4, height: 4 },
    cost: { coins: 0 },
    buildSeconds: 0,
    unlockLevel: 15,
    boost: LANDMARK_DECORATION.boost,
    radius: LANDMARK_DECORATION.radius,
    contentPhase: "p1",
    parts: [
      { assetId: "tile_plaza", role: "ground", count: 16 },
      { assetId: "deco_fountain", role: "centre", count: 1 },
      { assetId: "deco_lamp", role: "lamp", count: 4 },
    ],
  },
];

export function decorationById(id: DecorationId): DecorationDefinition {
  return byId(DECORATIONS, id, "decoration");
}
