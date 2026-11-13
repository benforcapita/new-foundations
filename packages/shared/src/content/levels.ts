export type LevelDefinition = {
  readonly level: number;
  readonly nameKey: string;
  readonly xpToNext: number | null;
  readonly unlocks: readonly string[];
};

export const LEVELS: readonly LevelDefinition[] = [
  { level: 1, nameKey: "level.1.name", xpToNext: 50, unlocks: ["B-001", "B-004", "B-007", "B-009", "AG-001", "GOOD_WHEAT", "GOOD_BREAD", "R-001"] },
  { level: 2, nameKey: "level.2.name", xpToNext: 120, unlocks: ["NPC-MIA"] },
  { level: 3, nameKey: "level.3.name", xpToNext: 220, unlocks: ["B-011"] },
  { level: 4, nameKey: "level.4.name", xpToNext: 350, unlocks: ["B-002", "B-008", "B-012", "AG-002", "GOOD_TIMBER", "GOOD_PLANKS"] },
  { level: 5, nameKey: "level.5.name", xpToNext: 500, unlocks: ["B-005", "AG-003", "GOOD_MILK", "GOOD_CHEESE"] },
  { level: 6, nameKey: "level.6.name", xpToNext: 700, unlocks: ["B-010"] },
  { level: 7, nameKey: "level.7.name", xpToNext: 950, unlocks: ["weekly-quests"] },
  { level: 8, nameKey: "level.8.name", xpToNext: 1250, unlocks: ["npc-franchise-board"] },
  { level: 9, nameKey: "level.9.name", xpToNext: 1600, unlocks: ["B-003"] },
  { level: 10, nameKey: "level.10.name", xpToNext: 2000, unlocks: ["B-006", "AG-004", "GOOD_FLOWERS", "GOOD_PAINT", "GOOD_BOOKS", "human-franchises"] },
  { level: 11, nameKey: "level.11.name", xpToNext: 2450, unlocks: [] },
  { level: 12, nameKey: "level.12.name", xpToNext: 2950, unlocks: ["harbor"] },
  { level: 13, nameKey: "level.13.name", xpToNext: 3500, unlocks: [] },
  { level: 14, nameKey: "level.14.name", xpToNext: 4100, unlocks: [] },
  { level: 15, nameKey: "level.15.name", xpToNext: null, unlocks: ["LM-001"] },
];
