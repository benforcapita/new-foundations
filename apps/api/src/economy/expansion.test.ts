import { expect, test } from "vitest";
import { planExpansion } from "./expansion";

const starter = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;

test("an adjacent chunk costs the first expansion price", () => {
  expect(planExpansion({ chunks: starter, x: 2, y: 0, tutorialComplete: true, coins: 1000 })).toEqual({ ok: true, cost: 1000 });
});

test("expansion requires the tutorial, adjacency, a free slot and enough coins", () => {
  expect(planExpansion({ chunks: starter, x: 2, y: 0, tutorialComplete: false, coins: 1000 })).toMatchObject({ ok: false, code: "TUTORIAL_INCOMPLETE" });
  expect(planExpansion({ chunks: starter, x: 2, y: 2, tutorialComplete: true, coins: 1000 })).toMatchObject({ ok: false, code: "INVALID_EXPANSION" });
  expect(planExpansion({ chunks: starter, x: 2, y: 0, tutorialComplete: true, coins: 999 })).toMatchObject({ ok: false, code: "INSUFFICIENT_COINS" });
  expect(planExpansion({ chunks: [...starter, [2, 0]], x: 3, y: 0, tutorialComplete: true, coins: 5000 })).toMatchObject({ ok: false, code: "EXPANSION_CAP" });
});
