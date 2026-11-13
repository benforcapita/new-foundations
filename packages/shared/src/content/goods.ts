import { byId, type AgricultureId, type ContentPhase, type GoodId, type RecipeId } from "./ids";

export type GoodTier = "raw" | "finished" | "advanced";

export type GoodDefinition = {
  readonly id: GoodId;
  readonly nameKey: string;
  readonly tier: GoodTier;
  readonly storageUnits: 1;
  readonly value: number;
  readonly unlockLevel: number;
  readonly iconAssetId: string;
  readonly contentPhase: ContentPhase;
  readonly source: { readonly kind: "plot"; readonly id: AgricultureId } | { readonly kind: "recipe"; readonly id: RecipeId };
};

export const GOODS: readonly GoodDefinition[] = [
  {
    id: "GOOD_WHEAT",
    nameKey: "good.wheat.name",
    tier: "raw",
    storageUnits: 1,
    value: 15,
    unlockLevel: 1,
    iconAssetId: "ico_goods_wheat",
    contentPhase: "p0",
    source: { kind: "plot", id: "AG-001" },
  },
  {
    id: "GOOD_TIMBER",
    nameKey: "good.timber.name",
    tier: "raw",
    storageUnits: 1,
    value: 20,
    unlockLevel: 4,
    iconAssetId: "ico_goods_wood",
    contentPhase: "p1",
    source: { kind: "plot", id: "AG-002" },
  },
  {
    id: "GOOD_MILK",
    nameKey: "good.milk.name",
    tier: "raw",
    storageUnits: 1,
    value: 25,
    unlockLevel: 5,
    iconAssetId: "ico_goods_milk",
    contentPhase: "p1",
    source: { kind: "plot", id: "AG-003" },
  },
  {
    id: "GOOD_FLOWERS",
    nameKey: "good.flowers.name",
    tier: "raw",
    storageUnits: 1,
    value: 20,
    unlockLevel: 10,
    iconAssetId: "ico_goods_flowers",
    contentPhase: "p1",
    source: { kind: "plot", id: "AG-004" },
  },
  {
    id: "GOOD_BREAD",
    nameKey: "good.bread.name",
    tier: "finished",
    storageUnits: 1,
    value: 60,
    unlockLevel: 1,
    iconAssetId: "ico_goods_bread",
    contentPhase: "p0",
    source: { kind: "recipe", id: "RCP-BREAD" },
  },
  {
    id: "GOOD_PLANKS",
    nameKey: "good.planks.name",
    tier: "finished",
    storageUnits: 1,
    value: 130,
    unlockLevel: 4,
    iconAssetId: "ico_goods_planks",
    contentPhase: "p1",
    source: { kind: "recipe", id: "RCP-PLANKS" },
  },
  {
    id: "GOOD_CHEESE",
    nameKey: "good.cheese.name",
    tier: "finished",
    storageUnits: 1,
    value: 90,
    unlockLevel: 5,
    iconAssetId: "ico_goods_cheese",
    contentPhase: "p1",
    source: { kind: "recipe", id: "RCP-CHEESE" },
  },
  {
    id: "GOOD_PAINT",
    nameKey: "good.paint.name",
    tier: "advanced",
    storageUnits: 1,
    value: 80,
    unlockLevel: 10,
    iconAssetId: "ico_goods_paint",
    contentPhase: "p1",
    source: { kind: "recipe", id: "RCP-PAINT" },
  },
  {
    id: "GOOD_BOOKS",
    nameKey: "good.books.name",
    tier: "advanced",
    storageUnits: 1,
    value: 220,
    unlockLevel: 10,
    iconAssetId: "ico_goods_books",
    contentPhase: "p1",
    source: { kind: "recipe", id: "RCP-BOOKS" },
  },
];

export function goodById(id: GoodId): GoodDefinition {
  return byId(GOODS, id, "good");
}
