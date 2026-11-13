import { expect, test } from "vitest";
import { CONTENT_VERSION } from "../content/index";
import {
  ERROR_HTTP_STATUS,
  apiErrorForPlaceReason,
  apiErrorSchema,
  catalogQuerySchema,
  catalogResponseSchema,
  collectAllCommandSchema,
  commandBodySchemas,
  commandHeadersSchema,
  commandSuccessSchema,
  expandLandCommandSchema,
  franchiseRequestCommandSchema,
  franchiseSupplyCommandSchema,
  healthResponseSchema,
  snapshotQuerySchema,
  startProductionCommandSchema,
  trainSupplyCommandSchema,
} from "./api";
import { deltaSchema, snapshotSchema, type Snapshot } from "./snapshot";

const headers = {
  authorization: "Bearer session-token",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  cityVersion: 4,
  contentVersion: CONTENT_VERSION,
};

function sampleSnapshot(): Snapshot {
  return {
    city: {
      cityId: "city-1",
      ownerId: "player-1",
      name: "First Town",
      isNpc: false,
      level: 1,
      xp: 0,
      coins: 750,
      gems: 0,
      civicStars: 0,
      population: 8,
      populationCap: 50,
      warehouseTier: 0,
      warehouseCap: 40,
      collectPriority: "QUEST_FIRST",
      contentVersion: CONTENT_VERSION,
      version: 4,
    },
    cells: [{ x: 0, y: 0, terrainId: "grass", ownerClaimed: true }],
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
    inventory: { GOOD_BREAD: 3 },
    jobs: [
      {
        id: "j1",
        buildingId: "bakery-1",
        slot: 0,
        recipeId: "RCP-BREAD",
        startedAt: "2026-11-13T12:00:00.000Z",
        completesAt: "2026-11-13T12:06:00.000Z",
        version: 1,
      },
    ],
    orders: [
      {
        id: "o1",
        slot: 0,
        templateId: "ORD-T-001",
        difficulty: "story",
        requirements: { GOOD_BREAD: 3 },
        reward: { coins: 180, xp: 12, civicStars: 1 },
        status: "OPEN",
        version: 1,
      },
    ],
    train: {
      id: "t1",
      state: "LOADING",
      departedAt: null,
      returnsAt: null,
      version: 1,
      wagons: [
        { goodId: "GOOD_WHEAT", qty: 3, filled: false, reward: 0, paid: false },
        { goodId: "GOOD_BREAD", qty: 4, filled: false, reward: 0, paid: false },
        { goodId: "GOOD_MILK", qty: 3, filled: false, reward: 0, paid: false },
      ],
    },
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
    quests: [
      {
        questId: "quest_tutorial_house",
        periodKey: "-",
        track: "story",
        status: "ACTIVE",
        stepState: { "0": 0 },
        version: 1,
      },
    ],
    serverNow: "2026-11-13T12:00:00.000Z",
    contentVersion: CONTENT_VERSION,
    cityVersion: 4,
  };
}

function sampleDelta() {
  const snapshot = sampleSnapshot();
  return {
    fromVersion: 4,
    toVersion: 5,
    buildings: snapshot.buildings,
    removedBuildingIds: ["gone"],
    inventory: snapshot.inventory,
    jobs: [],
    orders: [],
    franchises: [],
    quests: [],
  };
}

test("snapshot and delta use the LLD envelope", () => {
  const snapshot = sampleSnapshot();
  expect(snapshotSchema.parse(snapshot)).toMatchObject({
    city: { cityId: "city-1" },
    serverNow: snapshot.serverNow,
    contentVersion: CONTENT_VERSION,
    cityVersion: 4,
  });
  expect(snapshot.cells).toHaveLength(1);
  const delta = deltaSchema.parse(sampleDelta());
  expect(delta.toVersion).toBe(5);
  expect(delta.removedBuildingIds).toEqual(["gone"]);
  expect(deltaSchema.safeParse({ ...sampleDelta(), toVersion: 3 }).success).toBe(false);
  expect(snapshotSchema.safeParse({ ...snapshot, buildings: [{ ...snapshot.buildings[0], state: "ASLEEP" }] }).success).toBe(
    false,
  );
});

test("command bodies match the LLD and reject the previous shapes", () => {
  const bodies = {
    "place-building": { definitionId: "B-001", x: 0, y: 0, rotation: 0 },
    "move-building": { instanceId: "b1", x: 3, y: 3, rotation: 1 },
    "remove-building": { instanceId: "b1" },
    "collect-all": {},
    collect: { instanceId: "b1" },
    "start-production": { instanceId: "bakery-1", recipeId: "RCP-BREAD" },
    "cancel-production": { instanceId: "bakery-1", jobId: "j1" },
    "supply-business": { instanceId: "grocery-1" },
    "fulfill-order": { orderId: "o1" },
    "reroll-order": { orderId: "o1" },
    "expand-land": { chunkX: 2, chunkY: 0 },
    "upgrade-warehouse": {},
    "upgrade-building": { instanceId: "b1" },
    "train-supply": { wagonIndex: 0, qty: 3 },
    "train-dispatch": {},
    "train-help-request": { wagonIndex: 1 },
    "npc-visit-action": { npcCityId: "NPC-CITY-DANA", action: "harvest", targetId: "plot-1" },
    "set-collect-priority": { priority: "OLDEST_FIRST" },
    "claim-quest": { questId: "quest_flower_street", periodKey: "-" },
    "franchise-request": { hostCityId: "NPC-CITY-DANA", plotId: "plot-1", businessDefinitionId: "B-004" },
    "franchise-supply": { cycles: 2 },
    "franchise-collect": {},
    "auth-session": {},
    telemetry: { events: [{ name: "ui_open" }] },
  } as const;

  for (const [name, body] of Object.entries(bodies)) {
    const schema = commandBodySchemas[name as keyof typeof commandBodySchemas];
    expect(schema.parse(body)).toEqual(body);
  }

  expect(commandHeadersSchema.parse(headers).idempotencyKey).toBe(headers.idempotencyKey);
  expect(placeBuildingBodyRejected()).toBe(false);
  expect(collectAllCommandSchema.safeParse({ priority: "quest-first" }).success).toBe(false);
  expect(startProductionCommandSchema.safeParse({ buildingId: "bakery-1", recipeId: "RCP-BREAD" }).success).toBe(false);
  expect(expandLandCommandSchema.safeParse({ chunkX: 2, chunkY: 0, type: "expand-chunk" }).success).toBe(false);
  expect(trainSupplyCommandSchema.safeParse({ trainId: "t1", wagonIndex: 0, goodId: "GOOD_WHEAT", qty: 3 }).success).toBe(false);
  expect(trainSupplyCommandSchema.safeParse({ wagonIndex: 3, qty: 3 }).success).toBe(false);
  expect(franchiseRequestCommandSchema.safeParse({ hostCityId: "NPC-CITY-DANA", plotX: 1, plotY: 1, businessDefinitionId: "B-004" }).success).toBe(
    false,
  );
  expect(franchiseSupplyCommandSchema.safeParse({ goods: [{ goodId: "GOOD_BREAD", qty: 3 }] }).success).toBe(false);
  expect(franchiseSupplyCommandSchema.safeParse({ cycles: 3 }).success).toBe(false);
});

function placeBuildingBodyRejected(): boolean {
  return commandBodySchemas["place-building"].safeParse({ definitionId: "B-001", x: 0, y: 0, rotation: 4 }).success;
}

test("success and error envelopes use result, delta, and LLD status codes", () => {
  const delta = deltaSchema.parse({ ...sampleDelta(), toVersion: 4, removedBuildingIds: [] });
  expect(commandSuccessSchema.parse({ result: { instanceId: "b1" }, delta, cityVersion: 4 }).cityVersion).toBe(4);
  expect(commandSuccessSchema.safeParse({ ok: true, cityVersion: 4, contentVersion: 1, replayed: true, delta }).success).toBe(false);

  const failure = apiErrorSchema.parse({
    error: { code: "CELL_OCCUPIED", message: "That spot is taken", details: { x: 1, y: 2 } },
    delta,
    cityVersion: 5,
  });
  expect(ERROR_HTTP_STATUS[failure.error.code]).toBe(409);
  expect(ERROR_HTTP_STATUS.INSUFFICIENT_COINS).toBe(409);
  expect(ERROR_HTTP_STATUS.INSUFFICIENT_GOODS).toBe(409);
  expect(ERROR_HTTP_STATUS.STATE_CHANGED).toBe(409);
  expect(ERROR_HTTP_STATUS.CONTENT_VERSION_MISMATCH).toBe(412);
  expect(ERROR_HTTP_STATUS.POP_CAP_REACHED).toBe(422);
  expect(ERROR_HTTP_STATUS.IDEMPOTENCY_KEY_REUSED).toBe(422);
  expect(ERROR_HTTP_STATUS.REROLL_COOLDOWN).toBe(422);
  expect(apiErrorForPlaceReason("OCCUPIED")).toEqual({ code: "CELL_OCCUPIED", status: 409 });
  expect(apiErrorForPlaceReason("POP_CAP")).toEqual({ code: "POP_CAP_REACHED", status: 422 });
  expect(apiErrorSchema.safeParse({ ok: false, error: { code: "OCCUPIED", message: "no" } }).success).toBe(false);

  expect(snapshotQuerySchema.parse({ cityId: "city-1", sinceVersion: 3 })).toEqual({ cityId: "city-1", sinceVersion: 3 });
  expect(catalogQuerySchema.parse({ version: 1 })).toEqual({ version: 1 });
  expect(catalogResponseSchema.parse({ contentVersion: CONTENT_VERSION, catalog: { buildings: [] } }).contentVersion).toBe(
    CONTENT_VERSION,
  );
  expect(healthResponseSchema.parse({ ok: true, db: "up", version: "1" }).db).toBe("up");
});
