import { expect, test } from "vitest";
import { nextSupplyStreak } from "./franchise";
import { franchiseSplit, franchiseTotal } from "@nf/shared";

test("supply streak changes at UTC midnight and resets after a missed day", () => {
  expect(nextSupplyStreak("2026-11-12", 4, new Date("2026-11-12T23:59:59Z"))).toBe(4);
  expect(nextSupplyStreak("2026-11-12", 4, new Date("2026-11-13T00:00:00Z"))).toBe(5);
  expect(nextSupplyStreak("2026-11-11", 4, new Date("2026-11-13T00:00:00Z"))).toBe(1);
  const total = franchiseTotal(110, 100);
  expect(total).toBe(121);
  expect(franchiseSplit(total)).toEqual({ owner: 72, host: 49 });
});
