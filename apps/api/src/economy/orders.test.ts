import { expect, test } from "vitest";
import { orderSolvable, generatedOrder } from "./orders";
import type { World } from "./model";

function world(balances: Record<string, number>, buildings: string[]): World {
  return { city: { id: "city", level: 1, xp: 0, coins: 0, gems: 0, civicStars: 0, version: 1, population: 0, populationCap: 50, warehouseCap: 40, collectPriority: "QUEST_FIRST", tutorialState: null, unlockedChunks: [], width: 24, height: 24 }, now: 0, cells: [], jobs: [], quests: [], balances, buildings: buildings.map((definitionId) => ({ id: definitionId, definitionId, level: 1, x: 0, y: 0, rotation: 0, state: "ACTIVE", constructionCompletesAt: null, cycleStartedAt: null, lastCollectedAt: null, stock: { goods: {}, pendingCoins: 0, tutorialCycle: false, tutorialUsed: false, paidCoins: 0 }, outputReady: null, removedAt: null, undoExpiresAt: null, createdAt: 0 })) };
}

test("solvability respects finite inventory and the entire owned production chain", () => {
  const bread = [{ goodId: "GOOD_BREAD", qty: 3 }];
  expect(orderSolvable(world({ GOOD_BREAD: 1 }, []), bread)).toBe(false);
  expect(orderSolvable(world({ GOOD_WHEAT: 1 }, ["B-007"]), bread)).toBe(false);
  expect(orderSolvable(world({ GOOD_WHEAT: 2 }, ["B-007"]), bread)).toBe(true);
  expect(orderSolvable(world({}, ["B-007", "AG-001"]), bread)).toBe(true);
});

test("generation avoids three cards on the same good", () => {
  const order = generatedOrder(world({}, ["AG-001"]), [[{ goodId: "GOOD_WHEAT", qty: 3 }], [{ goodId: "GOOD_WHEAT", qty: 3 }]]);
  expect(order.requirements[0]?.goodId).toBe("GOOD_BREAD");
});

test("reroll changes the good when another valid choice exists", () => {
  const other = [[{ goodId: "GOOD_BREAD", qty: 3 }], [{ goodId: "GOOD_WHEAT", qty: 3 }]];
  const order = generatedOrder(world({}, ["AG-001"]), other, ["GOOD_BREAD"]);
  expect(order.requirements[0]?.goodId).toBe("GOOD_WHEAT");
});
