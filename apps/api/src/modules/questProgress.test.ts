import { expect, test } from "vitest";
import { advanceQuestStep } from "./questProgress";

test.each(["order_completed", "franchise_supply", "expansion_claimed"] as const)("quest progression consumes %s events", (event) => {
  const step = { event, filter: {}, amount: 1 };
  expect(advanceQuestStep(step, { "0": 0 }, 0, { name: event, payload: {} })).toEqual({ state: { "0": 1 }, index: 1 });
  expect(advanceQuestStep(step, { "0": 0 }, 0, { name: "other", payload: {} })).toBeNull();
});
