import { byId, type AgricultureId, type ContentPhase, type Footprint, type GoodId } from "./ids";

export type AgriculturePlot = {
  readonly id: AgricultureId;
  readonly nameKey: string;
  readonly footprint: Footprint;
  readonly cost: { readonly coins: number };
  readonly buildSeconds: 0;
  readonly autoReplant: true;
  readonly unlockLevel: number;
  readonly groundAssetId: string;
  readonly groundTileCount: 4;
  readonly propAssetId?: string;
  readonly overlayAssetId: string;
  readonly outputGoodId: GoodId;
  readonly outputQty: 3;
  readonly cycleSeconds: number;
  readonly contentPhase: ContentPhase;
};

export const AGRICULTURE: readonly AgriculturePlot[] = [
  {
    id: "AG-001",
    nameKey: "agriculture.wheat.name",
    footprint: { width: 2, height: 2 },
    cost: { coins: 20 },
    buildSeconds: 0,
    autoReplant: true,
    unlockLevel: 1,
    groundAssetId: "tile_grass_flowers",
    groundTileCount: 4,
    overlayAssetId: "ico_goods_wheat",
    outputGoodId: "GOOD_WHEAT",
    outputQty: 3,
    cycleSeconds: 180,
    contentPhase: "p0",
  },
  {
    id: "AG-002",
    nameKey: "agriculture.trees.name",
    footprint: { width: 2, height: 2 },
    cost: { coins: 40 },
    buildSeconds: 0,
    autoReplant: true,
    unlockLevel: 4,
    groundAssetId: "tile_grass",
    groundTileCount: 4,
    propAssetId: "deco_tree_oak",
    overlayAssetId: "ico_goods_wood",
    outputGoodId: "GOOD_TIMBER",
    outputQty: 3,
    cycleSeconds: 300,
    contentPhase: "p1",
  },
  {
    id: "AG-003",
    nameKey: "agriculture.dairy.name",
    footprint: { width: 2, height: 2 },
    cost: { coins: 60 },
    buildSeconds: 0,
    autoReplant: true,
    unlockLevel: 5,
    groundAssetId: "tile_grass",
    groundTileCount: 4,
    propAssetId: "deco_flower_patch",
    overlayAssetId: "ico_goods_milk",
    outputGoodId: "GOOD_MILK",
    outputQty: 3,
    cycleSeconds: 480,
    contentPhase: "p1",
  },
  {
    id: "AG-004",
    nameKey: "agriculture.flowers.name",
    footprint: { width: 2, height: 2 },
    cost: { coins: 40 },
    buildSeconds: 0,
    autoReplant: true,
    unlockLevel: 10,
    groundAssetId: "tile_grass_flowers",
    groundTileCount: 4,
    propAssetId: "deco_flower_patch",
    overlayAssetId: "ico_goods_flowers",
    outputGoodId: "GOOD_FLOWERS",
    outputQty: 3,
    cycleSeconds: 300,
    contentPhase: "p1",
  },
];

export function agricultureById(id: AgricultureId): AgriculturePlot {
  return byId(AGRICULTURE, id, "agriculture plot");
}
