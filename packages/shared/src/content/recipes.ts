import { byId, type BuildingId, type ContentPhase, type GoodStack, type RecipeId } from "./ids";

export type RecipeDefinition = {
  readonly id: RecipeId;
  readonly nameKey: string;
  readonly buildingId: BuildingId;
  readonly unlockLevel: number;
  readonly seconds: number;
  readonly inputs: readonly GoodStack[];
  readonly outputs: readonly GoodStack[];
  readonly contentPhase: ContentPhase;
};

export const RECIPES: readonly RecipeDefinition[] = [
  {
    id: "RCP-BREAD",
    nameKey: "recipe.bread.name",
    buildingId: "B-007",
    unlockLevel: 1,
    seconds: 360,
    inputs: [{ goodId: "GOOD_WHEAT", qty: 2 }],
    outputs: [{ goodId: "GOOD_BREAD", qty: 3 }],
    contentPhase: "p0",
  },
  {
    id: "RCP-PLANKS",
    nameKey: "recipe.planks.name",
    buildingId: "B-008",
    unlockLevel: 4,
    seconds: 900,
    inputs: [{ goodId: "GOOD_TIMBER", qty: 3 }],
    outputs: [{ goodId: "GOOD_PLANKS", qty: 2 }],
    contentPhase: "p1",
  },
  {
    id: "RCP-CHEESE",
    nameKey: "recipe.cheese.name",
    buildingId: "B-007",
    unlockLevel: 5,
    seconds: 720,
    inputs: [{ goodId: "GOOD_MILK", qty: 2 }],
    outputs: [{ goodId: "GOOD_CHEESE", qty: 2 }],
    contentPhase: "p1",
  },
  {
    id: "RCP-PAINT",
    nameKey: "recipe.paint.name",
    buildingId: "B-008",
    unlockLevel: 10,
    seconds: 1200,
    inputs: [{ goodId: "GOOD_FLOWERS", qty: 2 }],
    outputs: [{ goodId: "GOOD_PAINT", qty: 2 }],
    contentPhase: "p1",
  },
  {
    id: "RCP-BOOKS",
    nameKey: "recipe.books.name",
    buildingId: "B-008",
    unlockLevel: 10,
    seconds: 1800,
    inputs: [
      { goodId: "GOOD_TIMBER", qty: 2 },
      { goodId: "GOOD_PAINT", qty: 1 },
    ],
    outputs: [{ goodId: "GOOD_BOOKS", qty: 2 }],
    contentPhase: "p1",
  },
];

export function recipeById(id: RecipeId): RecipeDefinition {
  return byId(RECIPES, id, "recipe");
}
