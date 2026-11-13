import { expect, test } from "vitest";
import { isUuid } from "../crypto";
import { deterministicUuid } from "./ids";

test("npc keys map to a stable uuid", () => {
  const dana = deterministicUuid("dana_city");
  expect(dana).toBe(deterministicUuid("dana_city"));
  expect(dana).not.toBe(deterministicUuid("amir_garden"));
  expect(isUuid(dana)).toBe(true);
});
