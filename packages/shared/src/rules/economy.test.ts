import { expect, test } from "vitest";
import { buildingById } from "../content/buildings";
import { LEVELS } from "../content/levels";
import {
  CHUNK_SIZE,
  DECORATION_BOOST_CAP,
  FRANCHISE_OWNER_SPLIT_BPS,
  PASSIVE_CAP_SECONDS,
  ROAD_BONUS,
  UNDO_WINDOW_SECONDS,
  WORLD_SIZE,
  buildingUpgradeCost,
  businessReward,
  decorationBoostFor,
  effectiveBuildSeconds,
  effectivePlacementCost,
  expansionCost,
  franchiseSplit,
  franchiseTotal,
  levelForXp,
  levelMultiplier,
  orderReward,
  populationCapTotal,
  populationTotal,
  removalRefund,
  rentCollectible,
  roadBonusFor,
  trainCompletionBonus,
  trainReturnsAt,
  trainWagonReward,
  warehouseCapacity,
  warehouseUpgradeCost,
} from "./economy";

test("level multipliers are 1, 1.25, and 1.5", () => {
  expect(levelMultiplier(1)).toBe(1);
  expect(levelMultiplier(2)).toBe(1.25);
  expect(levelMultiplier(3)).toBe(1.5);
});

test("population and population cap scale by level", () => {
  expect(populationTotal([])).toBe(0);
  expect(populationTotal([{ population: 8, level: 1 }])).toBe(8);
  expect(populationTotal([{ population: 8, level: 2 }, { population: 18, level: 2 }])).toBe(8 * 1.25 + 18 * 1.25);
  expect(populationCapTotal([{ populationCap: 50, level: 1 }, { populationCap: 75, level: 1 }])).toBe(125);
  expect(populationCapTotal([{ populationCap: 50, level: 3 }])).toBe(75);
});

test("grocery pays 110 coins per 600 second cycle before bonuses", () => {
  const grocery = buildingById("B-004");
  expect(grocery.category).toBe("commercial");
  if (grocery.category !== "commercial") {
    return;
  }
  expect(grocery.coinYield).toBe(110);
  expect(grocery.salesCycleSeconds).toBe(600);
  expect(businessReward({ baseCoins: grocery.coinYield, level: 1, decorationBoost: 0, roadBonus: 0 })).toBe(110);
  expect(businessReward({ baseCoins: 110, level: 1, decorationBoost: 0, roadBonus: ROAD_BONUS })).toBe(115);
  expect(
    businessReward({ baseCoins: 110, level: 2, decorationBoost: 0.2, roadBonus: 0.05 }),
  ).toBe(Math.floor(110 * 1.25 * 1.25));
});

test("passive rent is capped at 12 hours of cycles", () => {
  expect(PASSIVE_CAP_SECONDS).toBe(43_200);
  expect(
    rentCollectible({ now: 1_000_000, lastCollectedAt: 0, cycleSeconds: 480, baseRent: 32, level: 1 }),
  ).toBe(90 * 32);
  expect(rentCollectible({ now: 479, lastCollectedAt: 0, cycleSeconds: 480, baseRent: 32, level: 1 })).toBe(0);
  expect(rentCollectible({ now: 480, lastCollectedAt: 0, cycleSeconds: 480, baseRent: 32, level: 1 })).toBe(32);
  expect(rentCollectible({ now: 959, lastCollectedAt: 0, cycleSeconds: 480, baseRent: 32, level: 1 })).toBe(32);
  expect(
    rentCollectible({ now: 1_000_000, lastCollectedAt: 0, cycleSeconds: 480, baseRent: 32, level: 2 }),
  ).toBe(90 * 32 * 1.25);
  expect(rentCollectible({ now: 10, lastCollectedAt: 50, cycleSeconds: 480, baseRent: 32, level: 1 })).toBe(0);
  expect(() =>
    rentCollectible({ now: 10, lastCollectedAt: 0, cycleSeconds: 0, baseRent: 32, level: 1 }),
  ).toThrow(/cycleSeconds/);
});

test("decoration boost counts each definition once and caps at 0.20", () => {
  const business = { x: 5, y: 5, width: 2, height: 2 };
  expect(
    decorationBoostFor(business, [
      { definitionId: "D-001", bonus: 0.01, radius: 2, x: 7, y: 5, width: 1, height: 1 },
      { definitionId: "D-001", bonus: 0.01, radius: 2, x: 8, y: 5, width: 1, height: 1 },
      { definitionId: "D-002", bonus: 0.01, radius: 2, x: 20, y: 20, width: 1, height: 1 },
    ]),
  ).toBe(0.01);
  const many = Array.from({ length: 30 }, (_, index) => ({
    definitionId: `D-${index}`,
    bonus: 0.01,
    radius: 2,
    x: 5,
    y: 5,
    width: 1,
    height: 1,
  }));
  expect(decorationBoostFor(business, many)).toBe(DECORATION_BOOST_CAP);
  expect(DECORATION_BOOST_CAP).toBe(0.2);
});

test("road bonus is 0.05 only when a footprint edge touches a road", () => {
  const footprint = { x: 4, y: 4, width: 2, height: 2 };
  expect(roadBonusFor(footprint, [])).toBe(0);
  expect(roadBonusFor(footprint, [{ x: 4, y: 4 }])).toBe(0);
  expect(roadBonusFor(footprint, [{ x: 3, y: 4 }])).toBe(ROAD_BONUS);
  expect(ROAD_BONUS).toBe(0.05);
});

test("order rewards use difficulty coefficients, a 5 XP floor, and one civic star", () => {
  expect(orderReward([{ qty: 3, value: 60 }], "easy")).toEqual({ coins: 180, xp: 12, civicStars: 1 });
  expect(orderReward([{ qty: 1, value: 15 }], "easy")).toEqual({ coins: 15, xp: 5, civicStars: 1 });
  expect(
    orderReward(
      [
        { qty: 2, value: 130 },
        { qty: 1, value: 60 },
      ],
      "medium",
    ),
  ).toEqual({ coins: 352, xp: 23, civicStars: 1 });
  expect(orderReward([{ qty: 2, value: 220 }], "specialized")).toEqual({ coins: 550, xp: 37, civicStars: 1 });
});

test("franchise split sums to the total for every value from 1 to 10000", () => {
  expect(FRANCHISE_OWNER_SPLIT_BPS).toBe(6000);
  expect(franchiseTotal(100, 1)).toBe(100);
  expect(franchiseTotal(100, 0)).toBe(100);
  expect(franchiseTotal(100, 2)).toBe(102);
  expect(franchiseTotal(100, 6)).toBe(110);
  expect(franchiseTotal(100, 40)).toBe(110);
  for (let total = 1; total <= 10_000; total += 1) {
    const split = franchiseSplit(total);
    expect(split.owner + split.host).toBe(total);
    expect(split.owner).toBe(Math.floor((total * 6000) / 10_000));
  }
});

test("warehouse capacity and upgrade costs follow the tier table", () => {
  expect(warehouseCapacity(0)).toBe(40);
  expect(warehouseCapacity(1)).toBe(60);
  expect(warehouseCapacity(5)).toBe(140);
  expect(warehouseUpgradeCost(1)).toEqual({ coins: 400, planks: 0 });
  expect(warehouseUpgradeCost(2)).toEqual({ coins: 800, planks: 4 });
  expect(warehouseUpgradeCost(5)).toEqual({ coins: 2000, planks: 10 });
  expect(() => warehouseCapacity(6)).toThrow(/tier/);
  expect(() => warehouseUpgradeCost(0)).toThrow(/tier/);
  expect(() => warehouseUpgradeCost(6)).toThrow(/tier/);
});

test("building upgrades bill coins, time, and paint or planks", () => {
  expect(buildingUpgradeCost({ coinCost: 180, buildSeconds: 30, currentLevel: 1, paintUnlocked: false })).toEqual({
    ok: true,
    coins: 144,
    seconds: 30,
    goods: [],
  });
  expect(buildingUpgradeCost({ coinCost: 180, buildSeconds: 30, currentLevel: 2, paintUnlocked: false })).toEqual({
    ok: true,
    coins: 288,
    seconds: 60,
    goods: [{ goodId: "GOOD_PLANKS", qty: 2 }],
  });
  expect(buildingUpgradeCost({ coinCost: 180, buildSeconds: 30, currentLevel: 2, paintUnlocked: true })).toEqual({
    ok: true,
    coins: 288,
    seconds: 60,
    goods: [{ goodId: "GOOD_PAINT", qty: 2 }],
  });
  expect(buildingUpgradeCost({ coinCost: 180, buildSeconds: 30, currentLevel: 3, paintUnlocked: true })).toEqual({
    ok: false,
    reason: "MAX_LEVEL",
  });
});

test("removal refunds half the coin cost inside a 10 second undo window", () => {
  expect(removalRefund(180)).toBe(90);
  expect(removalRefund(1750)).toBe(875);
  expect(removalRefund(1)).toBe(0);
  expect(UNDO_WINDOW_SECONDS).toBe(10);
});

test("expansion cost starts at 1000 and grows by 1.6", () => {
  expect(CHUNK_SIZE).toBe(12);
  expect(WORLD_SIZE).toBe(48);
  expect(expansionCost(0)).toBe(1000);
  expect(expansionCost(1)).toBe(1600);
  expect(expansionCost(2)).toBe(2560);
  expect(expansionCost(3)).toBe(4096);
  expect(() => expansionCost(-1)).toThrow(/expansionIndex/);
});

test("train wagons pay 1.2 value, a 25 percent full bonus, and return after an hour", () => {
  expect(trainWagonReward(3, 60)).toBe(216);
  expect(trainWagonReward(8, 15)).toBe(Math.round(8 * 15 * 1.2));
  expect(() => trainWagonReward(2, 15)).toThrow(/3 to 8/);
  expect(() => trainWagonReward(9, 15)).toThrow(/3 to 8/);
  expect(trainCompletionBonus([216, 216, 216])).toEqual({ coins: 162, civicStars: 1 });
  expect(() => trainCompletionBonus([1, 2])).toThrow(/3 wagon/);
  expect(trainReturnsAt(1_000)).toBe(4_600);
});

test("xp thresholds promote the city at each cumulative gate", () => {
  expect(LEVELS.map((level) => level.xpToNext)).toEqual([
    50, 120, 220, 350, 500, 700, 950, 1250, 1600, 2000, 2450, 2950, 3500, 4100, null,
  ]);
  expect(levelForXp(0)).toBe(1);
  expect(levelForXp(49)).toBe(1);
  expect(levelForXp(50)).toBe(2);
  expect(levelForXp(4099)).toBe(14);
  expect(levelForXp(4100)).toBe(15);
  expect(levelForXp(99_999)).toBe(15);
  expect(() => levelForXp(-1)).toThrow(/xp/);
});

test("the first cottage and bakery are free and instant, and the first grocery is instant", () => {
  expect(effectivePlacementCost(180, true, 0)).toBe(0);
  expect(effectivePlacementCost(180, true, 1)).toBe(180);
  expect(effectiveBuildSeconds(30, true, 0)).toBe(0);
  expect(effectiveBuildSeconds(30, true, 1)).toBe(30);
  expect(effectivePlacementCost(500, false, 0)).toBe(500);
  expect(effectiveBuildSeconds(120, true, 0)).toBe(0);
});
