import trainBalance from "./train.balance.json" with { type: "json" };

export type QuestEvent =
  | "train_supplied"
  | "building_placed"
  | "goods_produced"
  | "goods_collected"
  | "business_supplied"
  | "coins_collected"
  | "order_completed"
  | "franchise_supply"
  | "decoration_placed"
  | "expansion_claimed";

export type QuestDefinition = {
  readonly id: string;
  readonly nameKey: string;
  readonly track: "story" | "growth" | "weekly";
  readonly prerequisites: readonly string[];
  readonly steps: readonly {
    readonly event: QuestEvent;
    readonly filter: Readonly<Record<string, string>>;
    readonly amount: number;
  }[];
  readonly reward: {
    readonly coins: number;
    readonly xp: number;
    readonly decorationId?: "D-003";
  };
  readonly canExpire: false;
  readonly canPurchaseSkip: false;
};

export const QUESTS: readonly QuestDefinition[] = [
  {
    id: "quest_tom_train",
    nameKey: "quest.tom_train.title",
    track: "story",
    prerequisites: [],
    steps: [{ event: "train_supplied", filter: {}, amount: trainBalance.introWagonsRequired }],
    reward: trainBalance.introQuestReward,
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_tutorial_house",
    nameKey: "tutorial.build_house",
    track: "story",
    prerequisites: [],
    steps: [{ event: "building_placed", filter: { building_definition_id: "B-001" }, amount: 1 }],
    reward: { coins: 50, xp: 10 },
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_tutorial_grocery",
    nameKey: "tutorial.supply_grocery",
    track: "story",
    prerequisites: ["quest_tutorial_house"],
    steps: [{ event: "business_supplied", filter: { building_definition_id: "B-004" }, amount: 1 }],
    reward: { coins: 40, xp: 10 },
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_tutorial_bakery",
    nameKey: "tutorial.build_bakery",
    track: "story",
    prerequisites: ["quest_tutorial_grocery"],
    steps: [{ event: "building_placed", filter: { building_definition_id: "B-007" }, amount: 1 }],
    reward: { coins: 50, xp: 10 },
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_early_bakery_01",
    nameKey: "quest.early_bakery.title",
    track: "story",
    prerequisites: ["quest_tutorial_bakery"],
    steps: [
      { event: "building_placed", filter: { building_definition_id: "B-007" }, amount: 1 },
      { event: "goods_produced", filter: { good_id: "GOOD_BREAD" }, amount: 3 },
    ],
    reward: { coins: 150, xp: 25 },
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_flower_street",
    nameKey: "quest.flower_street.title",
    track: "story",
    prerequisites: ["quest_early_bakery_01"],
    steps: [
      { event: "building_placed", filter: { building_definition_id: "B-001" }, amount: 1 },
      { event: "goods_produced", filter: { good_id: "GOOD_WHEAT" }, amount: 3 },
      { event: "goods_produced", filter: { good_id: "GOOD_BREAD" }, amount: 3 },
      { event: "business_supplied", filter: { building_definition_id: "B-004" }, amount: 1 },
      { event: "coins_collected", filter: {}, amount: 1 },
      { event: "franchise_supply", filter: {}, amount: 1 },
      { event: "decoration_placed", filter: {}, amount: 1 },
    ],
    reward: { coins: 300, xp: 60, decorationId: "D-003" },
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_dana_franchise",
    nameKey: "quest.dana_franchise.title",
    track: "story",
    prerequisites: ["quest_tutorial_grocery"],
    steps: [{ event: "franchise_supply", filter: { host_city_id: "NPC-CITY-DANA" }, amount: 1 }],
    reward: { coins: 100, xp: 25 },
    canExpire: false,
    canPurchaseSkip: false,
  },
];
