import { expect, test } from "vitest";
import { AGRICULTURE_IDS, BUILDING_IDS, CONTENT_VERSION, DECORATION_IDS, GOOD_IDS, RECIPE_IDS } from "../content/index";
import {
  ERROR_HTTP_STATUS,
  catalogQuerySchema,
  catalogResponseSchema,
  commandResponseSchema,
  commandSchema,
  entitlementsQuerySchema,
  entitlementsResponseSchema,
  snapshotQuerySchema,
  snapshotResponseSchema,
} from "./api";
import { deltaSchema, snapshotSchema, type Snapshot } from "./snapshot";

const meta = { idempotencyKey: "cmd-1", cityVersion: 4, contentVersion: CONTENT_VERSION };

const header = {
  cityId: "city-1",
  ownerId: "player-1",
  name: "First Town",
  level: 1,
  xp: 0,
  coins: 750,
  gems: 0,
  civicStars: 0,
  version: 4,
  contentVersion: CONTENT_VERSION,
  population: 8,
  populationCap: 50,
  warehouseTier: 0,
  warehouseUsed: 3,
};

function sampleSnapshot(): Snapshot {
  return {
    header,
    buildings: [
      {
        id: "b1",
        definitionId: "B-001",
        level: 1,
        x: 2,
        y: 2,
        rotation: 0,
        state: "ACTIVE",
        version: 1,
      },
    ],
    plots: [
      {
        id: "p1",
        definitionId: "AG-001",
        x: 6,
        y: 6,
        state: "GROWING",
        plantedAt: 0,
        readyAt: 180,
      },
    ],
    decorations: [{ id: "d1", definitionId: "D-001", x: 1, y: 1, rotation: 0 }],
    roads: [{ id: "r1", x: 1, y: 2 }],
    inventory: [{ goodId: "GOOD_BREAD", qty: 3 }],
    orders: [
      {
        id: "o1",
        templateId: "ORD-EASY-BREAD",
        difficulty: "easy",
        requirements: [{ goodId: "GOOD_BREAD", qty: 3 }],
        status: "OPEN",
        solvable: true,
        rewardCoins: 180,
        rewardXp: 12,
        civicStars: 1,
      },
    ],
    productionJobs: [
      {
        id: "j1",
        buildingId: "bakery-1",
        recipeId: "RCP-BREAD",
        startedAt: 0,
        completesAt: 360,
        claimedAt: null,
        state: "PRODUCING",
      },
    ],
    franchises: [
      {
        id: "f1",
        ownerCityId: "city-1",
        hostCityId: "NPC-CITY-DANA",
        businessDefinitionId: "B-004",
        state: "ACTIVE",
        splitBps: 6000,
        streakDays: 1,
        version: 1,
      },
    ],
    trains: [
      {
        id: "t1",
        stationId: "station-1",
        state: "LOADING",
        departedAt: null,
        returnsAt: null,
        wagons: [
          { goodId: "GOOD_WHEAT", qty: 3, filled: false, rewardCoins: 0 },
          { goodId: "GOOD_BREAD", qty: 4, filled: false, rewardCoins: 0 },
          { goodId: "GOOD_MILK", qty: 3, filled: false, rewardCoins: 0 },
        ],
      },
    ],
    quests: [{ questId: "quest_tutorial_house", status: "ACTIVE", stepIndex: 0, version: 1 }],
    unlockedChunks: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  };
}

test("snapshot and delta schemas accept a starter city and reject illegal states", () => {
  const snapshot = sampleSnapshot();
  expect(snapshotSchema.parse(snapshot)).toMatchObject({ header: { cityId: "city-1" } });
  expect(snapshotResponseSchema.parse({ kind: "snapshot", snapshot }).kind).toBe("snapshot");

  const delta = {
    cityId: "city-1",
    baseVersion: 4,
    version: 5,
    upserts: { buildings: snapshot.buildings },
    removals: { buildingIds: ["gone"] },
  };
  expect(deltaSchema.parse(delta).version).toBe(5);
  expect(snapshotResponseSchema.parse({ kind: "delta", delta }).kind).toBe("delta");
  expect(deltaSchema.safeParse({ ...delta, version: 3 }).success).toBe(false);
  expect(snapshotSchema.safeParse({ ...snapshot, buildings: [{ ...snapshot.buildings[0], state: "ASLEEP" }] }).success).toBe(
    false,
  );
});

test("commands carry an idempotency key, city version, and content version", () => {
  const commands = [
    { type: "place-building", ...meta, definitionId: "B-001", x: 0, y: 0, rotation: 0 },
    { type: "move-building", ...meta, instanceId: "b1", x: 3, y: 3, rotation: 1 },
    { type: "remove-building", ...meta, instanceId: "b1" },
    { type: "collect-all", ...meta, priority: "quest-first" },
    { type: "start-production", ...meta, buildingId: "bakery-1", recipeId: "RCP-BREAD" },
    { type: "supply-business", ...meta, instanceId: "grocery-1" },
    { type: "fulfill-order", ...meta, orderId: "o1" },
    { type: "reroll-order", ...meta, orderId: "o1" },
    { type: "upgrade-building", ...meta, instanceId: "b1" },
    { type: "upgrade-warehouse", ...meta },
    { type: "expand-chunk", ...meta, chunkX: 2, chunkY: 0 },
    { type: "franchise-request", ...meta, hostCityId: "NPC-CITY-DANA", businessDefinitionId: "B-004", plotX: 1, plotY: 1 },
    { type: "franchise-accept", ...meta, franchiseId: "f1" },
    { type: "franchise-supply", ...meta, franchiseId: "f1", goods: [{ goodId: "GOOD_BREAD", qty: 3 }] },
    { type: "train-fill", ...meta, trainId: "t1", wagonIndex: 0, goodId: "GOOD_WHEAT", qty: 3 },
    { type: "train-depart", ...meta, trainId: "t1" },
  ] as const;

  for (const command of commands) {
    expect(commandSchema.parse(command).type).toBe(command.type);
  }

  expect(commandSchema.safeParse({ type: "place-building", ...meta, definitionId: "B-001", x: 0, y: 0, rotation: 4 }).success).toBe(
    false,
  );
  expect(
    commandSchema.safeParse({ type: "place-building", cityVersion: 1, contentVersion: 1, definitionId: "B-001", x: 0, y: 0, rotation: 0 })
      .success,
  ).toBe(false);
  expect(commandSchema.safeParse({ type: "train-fill", ...meta, trainId: "t1", wagonIndex: 3, goodId: "GOOD_WHEAT", qty: 3 }).success).toBe(
    false,
  );
});

test("command responses and queries cover conflict and catalog payloads", () => {
  const delta = deltaSchema.parse({
    cityId: "city-1",
    baseVersion: 4,
    version: 4,
    upserts: {},
    removals: {},
  });
  expect(commandResponseSchema.parse({ ok: true, cityVersion: 4, contentVersion: 1, replayed: true, delta }).ok).toBe(true);
  const failure = commandResponseSchema.parse({
    ok: false,
    error: { code: "VERSION_CONFLICT", message: "stale city", cityVersion: 5, delta },
  });
  expect(failure.ok).toBe(false);
  if (!failure.ok) {
    expect(ERROR_HTTP_STATUS[failure.error.code]).toBe(409);
  }
  expect(commandResponseSchema.safeParse({ ok: false, error: { code: "NOPE", message: "no" } }).success).toBe(false);

  expect(snapshotQuerySchema.parse({ cityId: "city-1", sinceVersion: 3 })).toEqual({ cityId: "city-1", sinceVersion: 3 });
  expect(catalogQuerySchema.parse({ version: 1 })).toEqual({ version: 1 });
  expect(
    catalogResponseSchema.parse({
      contentVersion: CONTENT_VERSION,
      buildingIds: BUILDING_IDS,
      agricultureIds: AGRICULTURE_IDS,
      goodIds: GOOD_IDS,
      recipeIds: RECIPE_IDS,
      decorationIds: DECORATION_IDS,
      roadIds: ["R-001"],
      levelCount: 15,
    }).levelCount,
  ).toBe(15);
  expect(entitlementsQuerySchema.parse({ userId: "player-1" }).userId).toBe("player-1");
  expect(
    entitlementsResponseSchema.parse({
      userId: "player-1",
      entitlements: [{ productId: "season-pass", storeTransactionId: "txn-1" }],
    }).entitlements,
  ).toHaveLength(1);
});
