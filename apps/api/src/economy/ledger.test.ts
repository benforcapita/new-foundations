import { expect, test } from "vitest";
import { placementXp } from "./ledger";

test("placement XP is zero for free placements and scales with charged coins", () => {
  expect(placementXp(0)).toBe(0);
  expect(placementXp(1)).toBe(5);
  expect(placementXp(180)).toBe(7);
  expect(() => placementXp(-1)).toThrow();
  expect(() => placementXp(1.5)).toThrow();
});
