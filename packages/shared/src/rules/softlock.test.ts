import { expect, test } from "vitest";
import { RECOVERY_ORDER } from "../content/orders";
import { collectReadyOutput, needsRecoveryOrder, removalBlock } from "./softlock";

test("a broke city with no solvable order receives the wheat recovery order", () => {
  expect(needsRecoveryOrder(179, [])).toBe(true);
  expect(needsRecoveryOrder(179, [{ solvable: false }, { solvable: false }])).toBe(true);
  expect(needsRecoveryOrder(180, [])).toBe(false);
  expect(needsRecoveryOrder(0, [{ solvable: true }])).toBe(false);
  expect(RECOVERY_ORDER).toMatchObject({
    requirements: [{ goodId: "GOOD_WHEAT", qty: 3 }],
    coins: 60,
    xp: 5,
  });
});

test("the last wheat plot and the last town hall cannot be removed", () => {
  expect(removalBlock({ definitionId: "AG-001", placedDefinitionIds: ["AG-001", "B-001"] })).toBe("LAST_WHEAT_PLOT");
  expect(removalBlock({ definitionId: "AG-001", placedDefinitionIds: ["AG-001", "AG-001"] })).toBeNull();
  expect(removalBlock({ definitionId: "B-009", placedDefinitionIds: ["B-009"] })).toBe("TOWN_HALL");
  expect(removalBlock({ definitionId: "B-009", placedDefinitionIds: ["B-009", "B-009"] })).toBeNull();
  expect(removalBlock({ definitionId: "B-001", placedDefinitionIds: ["B-001"] })).toBeNull();
});

test("ready output waits when the warehouse cannot take it", () => {
  expect(collectReadyOutput({ used: 40, cap: 40, readyUnits: 3 })).toEqual({
    collected: 0,
    remaining: 3,
    waiting: true,
    blocked: true,
  });
  expect(collectReadyOutput({ used: 38, cap: 40, readyUnits: 5 })).toEqual({
    collected: 2,
    remaining: 3,
    waiting: true,
    blocked: false,
  });
  expect(collectReadyOutput({ used: 0, cap: 40, readyUnits: 3 })).toEqual({
    collected: 3,
    remaining: 0,
    waiting: false,
    blocked: false,
  });
  expect(collectReadyOutput({ used: 40, cap: 40, readyUnits: 0 })).toEqual({
    collected: 0,
    remaining: 0,
    waiting: false,
    blocked: false,
  });
  expect(() => collectReadyOutput({ used: -1, cap: 40, readyUnits: 1 })).toThrow(/non-negative/);
});
