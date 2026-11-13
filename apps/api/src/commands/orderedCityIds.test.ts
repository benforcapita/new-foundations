import { expect, test } from "vitest";
import { orderedCityIds } from "./orderedCityIds";

test("city locks are sorted ascending and duplicates collapse", () => {
  expect(orderedCityIds(["dana_city", "amir_garden", "dana_city"])).toEqual(["amir_garden", "dana_city"]);
});
