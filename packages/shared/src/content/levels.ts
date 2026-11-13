export type LevelDefinition = {
  readonly level: number;
  readonly nameKey: string;
  readonly xpToNext: number | null;
  readonly unlocks: readonly string[];
  readonly reward?: { readonly coins: number; readonly civicStars: number };
};

export const LEVELS: readonly LevelDefinition[] = [
  {
    level: 1,
    nameKey: "level.1.name",
    xpToNext: 50,
    unlocks: ["B-001", "B-004", "B-007", "B-009", "AG-001", "R-001", "order-board", "GOOD_WHEAT", "GOOD_BREAD"],
  },
  { level: 2, nameKey: "level.2.name", xpToNext: 120, unlocks: ["NPC-MIA"] },
  { level: 3, nameKey: "level.3.name", xpToNext: 220, unlocks: ["B-011", "NPC-TOM"] },
  {
    level: 4,
    nameKey: "level.4.name",
    xpToNext: 350,
    unlocks: ["B-012", "B-008", "B-002", "AG-002", "D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007", "NPC-AMIR", "GOOD_TIMBER", "GOOD_PLANKS"],
  },
  {
    level: 5,
    nameKey: "level.5.name",
    xpToNext: 500,
    unlocks: ["B-005", "AG-003", "GOOD_CHEESE", "GOOD_MILK", "medium-orders", "queue-slot-3"],
  },
  { level: 6, nameKey: "level.6.name", xpToNext: 700, unlocks: ["B-010"] },
  { level: 7, nameKey: "level.7.name", xpToNext: 950, unlocks: ["weekly-quests"] },
  { level: 8, nameKey: "level.8.name", xpToNext: 1250, unlocks: ["npc-franchise-board"] },
  { level: 9, nameKey: "level.9.name", xpToNext: 1600, unlocks: ["B-003"] },
  {
    level: 10,
    nameKey: "level.10.name",
    xpToNext: 2000,
    unlocks: ["B-006", "AG-004", "GOOD_PAINT", "GOOD_BOOKS", "GOOD_FLOWERS"],
  },
  { level: 11, nameKey: "level.11.name", xpToNext: 2450, unlocks: ["warehouse-tier-4", "warehouse-tier-5"] },
  { level: 12, nameKey: "level.12.name", xpToNext: 2950, unlocks: [], reward: { coins: 500, civicStars: 1 } },
  { level: 13, nameKey: "level.13.name", xpToNext: 3500, unlocks: ["specialized-order-weight"] },
  { level: 14, nameKey: "level.14.name", xpToNext: 4100, unlocks: ["building-level-3"] },
  { level: 15, nameKey: "level.15.name", xpToNext: null, unlocks: ["LM-001"] },
];
