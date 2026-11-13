import { type GoodId, type GoodStack } from "./ids";

export type OrderDifficulty = "easy" | "medium" | "specialized";

export type OrderTemplate = {
  readonly id: string;
  readonly nameKey: string;
  readonly difficulty: OrderDifficulty;
  readonly unlockLevel: number;
  readonly requirements: readonly GoodStack[];
};

export const ORDER_TEMPLATES: readonly OrderTemplate[] = [
  {
    id: "ORD-EASY-BREAD",
    nameKey: "order.easy_bread.name",
    difficulty: "easy",
    unlockLevel: 1,
    requirements: [{ goodId: "GOOD_BREAD", qty: 3 }],
  },
  {
    id: "ORD-MED-PLANKS",
    nameKey: "order.medium_planks.name",
    difficulty: "medium",
    unlockLevel: 4,
    requirements: [
      { goodId: "GOOD_PLANKS", qty: 2 },
      { goodId: "GOOD_BREAD", qty: 1 },
    ],
  },
  {
    id: "ORD-MED-CHEESE",
    nameKey: "order.medium_cheese.name",
    difficulty: "medium",
    unlockLevel: 5,
    requirements: [{ goodId: "GOOD_CHEESE", qty: 2 }],
  },
  {
    id: "ORD-SPEC-PLANKS",
    nameKey: "order.specialized_planks.name",
    difficulty: "specialized",
    unlockLevel: 4,
    requirements: [
      { goodId: "GOOD_PLANKS", qty: 2 },
      { goodId: "GOOD_BREAD", qty: 1 },
    ],
  },
  {
    id: "ORD-SPEC-BOOKS",
    nameKey: "order.specialized_books.name",
    difficulty: "specialized",
    unlockLevel: 10,
    requirements: [{ goodId: "GOOD_BOOKS", qty: 2 }],
  },
];

export const ORDER_GENERATOR = {
  boardSize: 3,
  slotDifficulties: ["easy", "medium", "specialized"],
  freeRerollSeconds: 900,
  requireSolvable: true,
  avoidSharedGoods: true,
} as const;

export const RECOVERY_ORDER = {
  id: "ORD-RECOVERY",
  nameKey: "order.recovery.name",
  difficulty: "easy",
  coinThreshold: 180,
  requirements: [{ goodId: "GOOD_WHEAT", qty: 3 }],
  coins: 60,
  xp: 5,
} as const;

export type GeneratedOrder = {
  readonly id: string;
  readonly nameKey: string;
  readonly difficulty: OrderDifficulty;
  readonly requirements: readonly GoodStack[];
  readonly recovery: boolean;
  readonly coins?: number;
  readonly xp?: number;
};

export type OrderBoardInput = {
  readonly level: number;
  readonly coins: number;
  readonly unlockedGoodIds: readonly GoodId[];
  readonly hasSolvableOpenOrder: boolean;
};

function templateSolvable(template: OrderTemplate, input: OrderBoardInput): boolean {
  if (template.unlockLevel > input.level) {
    return false;
  }
  return template.requirements.every((line) => input.unlockedGoodIds.includes(line.goodId));
}

function sharesChosenGood(template: OrderTemplate, chosen: ReadonlySet<string>): boolean {
  return template.requirements.some((line) => chosen.has(line.goodId));
}

export function generateOrderBoard(input: OrderBoardInput): readonly GeneratedOrder[] {
  const recovery = input.coins < RECOVERY_ORDER.coinThreshold && !input.hasSolvableOpenOrder;
  const chosen = new Set<string>();
  const board: GeneratedOrder[] = [];

  for (const difficulty of ORDER_GENERATOR.slotDifficulties) {
    if (difficulty === "easy" && recovery) {
      for (const line of RECOVERY_ORDER.requirements) {
        chosen.add(line.goodId);
      }
      board.push({
        id: RECOVERY_ORDER.id,
        nameKey: RECOVERY_ORDER.nameKey,
        difficulty: RECOVERY_ORDER.difficulty,
        requirements: RECOVERY_ORDER.requirements,
        recovery: true,
        coins: RECOVERY_ORDER.coins,
        xp: RECOVERY_ORDER.xp,
      });
      continue;
    }

    const candidates = ORDER_TEMPLATES.filter(
      (template) => template.difficulty === difficulty && templateSolvable(template, input),
    );
    const preferred = ORDER_GENERATOR.avoidSharedGoods
      ? candidates.find((template) => !sharesChosenGood(template, chosen))
      : candidates[0];
    const picked = preferred ?? candidates[0];
    if (picked === undefined) {
      continue;
    }
    for (const line of picked.requirements) {
      chosen.add(line.goodId);
    }
    board.push({
      id: picked.id,
      nameKey: picked.nameKey,
      difficulty: picked.difficulty,
      requirements: picked.requirements,
      recovery: false,
    });
  }

  return board;
}
