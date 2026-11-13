export type QuestEvent =
  | "building_placed"
  | "goods_produced"
  | "business_supplied"
  | "decoration_placed"
  | "franchise_opened";

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
  readonly reward: { readonly coins: number; readonly xp: number };
  readonly canExpire: false;
  readonly canPurchaseSkip: false;
};

export const QUESTS: readonly QuestDefinition[] = [
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
    steps: [{ event: "decoration_placed", filter: { decoration_definition_id: "D-007" }, amount: 4 }],
    reward: { coins: 100, xp: 20 },
    canExpire: false,
    canPurchaseSkip: false,
  },
  {
    id: "quest_dana_franchise",
    nameKey: "quest.dana_franchise.title",
    track: "story",
    prerequisites: ["quest_tutorial_grocery"],
    steps: [{ event: "franchise_opened", filter: { host_city_id: "NPC-CITY-DANA" }, amount: 1 }],
    reward: { coins: 100, xp: 100 },
    canExpire: false,
    canPurchaseSkip: false,
  },
];
