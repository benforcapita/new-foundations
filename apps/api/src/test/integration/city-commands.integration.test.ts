import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { PASSIVE_CAP_SECONDS } from "@nf/shared";
import { apiErrorSchema, commandSuccessSchema, deltaSchema, snapshotSchema } from "@nf/shared/schemas";
import { buildApp } from "../../app";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";
import { seedNpcCities } from "../../db/seed/npcCities";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error(
    "DATABASE_URL is required for API integration tests. Start PostgreSQL 16 and export DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations.",
  );
}

const connectionString = databaseUrl;
let handle: DatabaseHandle;
let now = new Date("2026-11-13T12:00:00.000Z");
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  handle = createDatabase(connectionString);
  await migrate(handle.pool);
  await seedNpcCities(handle.db);
  app = buildApp({
    logger: false,
    database: handle,
    clock: () => now,
    rateLimit: { burst: 500, perMinute: 5000 },
  });
});

afterAll(async () => {
  await app.close();
  await handle.pool.end();
});

test("US-001 places the first cottage free and adds population once", async () => {
  const session = await guest();
  const key = randomUUID();
  const placed = await command(session, "place-building", { definitionId: "B-001", x: 0, y: 4, rotation: 0 }, key);
  expect(placed.statusCode).toBe(200);
  const body = commandSuccessSchema.parse(placed.json());
  expect(body.result).toMatchObject({ state: "ACTIVE", cost: 0, xp: 1, population: 8, populationCap: 50 });
  expect(body.cityVersion).toBe(2);
  const replay = await command(session, "place-building", { definitionId: "B-001", x: 0, y: 4, rotation: 0 }, key);
  expect(replay.statusCode).toBe(200);
  expect(replay.replayed).toBe("true");
  expect(replay.json()).toEqual(placed.json());
  const reused = await command(session, "place-building", { definitionId: "B-001", x: 0, y: 8, rotation: 0 }, key);
  expect(reused.statusCode).toBe(422);
  expect(apiErrorSchema.parse(reused.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  const city = await cityRow(session.cityId);
  expect(city).toMatchObject({ population: 8, coins: 750, xp: 1, version: 2 });
  const cottages = await handle.pool.query<{ count: string }>(
    "select count(*)::text as count from building_instances where city_id = $1 and definition_id = 'B-001' and removed_at is null",
    [session.cityId],
  );
  expect(cottages.rows[0]?.count).toBe("1");
  const xp = await handle.pool.query<{ rows: string; total: string }>(
    "select count(*)::text as rows, coalesce(sum(delta), 0)::text as total from inventory_ledger where city_id = $1 and resource = 'XP'",
    [session.cityId],
  );
  expect(xp.rows[0]).toEqual({ rows: "1", total: "1" });
  await assertLedgerReconciled(session.cityId);
});

test("US-002 settles rent for five ready cottages once", async () => {
  const session = await guest();
  const spots = [
    [0, 4],
    [2, 4],
    [0, 6],
    [2, 6],
    [0, 8],
  ] as const;
  for (const [x, y] of spots) {
    const placed = await command(session, "place-building", { definitionId: "B-001", x, y, rotation: 0 });
    expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
  }
  advance(30_000);
  const finished = await acknowledge(session);
  expect(finished.statusCode).toBe(200);
  const ready = await handle.pool.query<{ count: string }>(
    "select count(*)::text as count from building_instances where city_id = $1 and definition_id = 'B-001' and state = 'ACTIVE'",
    [session.cityId],
  );
  expect(ready.rows[0]?.count).toBe("5");
  advance(480_000);
  const collected = await command(session, "collect-all", {});
  expect(collected.statusCode, JSON.stringify(collected.json())).toBe(200);
  expect(commandSuccessSchema.parse(collected.json()).result).toMatchObject({ coins: 160, xp: 0 });
  const again = await command(session, "collect-all", {});
  expect(again.statusCode).toBe(200);
  expect(commandSuccessSchema.parse(again.json()).result).toMatchObject({ coins: 0 });
  const city = await cityRow(session.cityId);
  expect(city.population).toBe(40);
  expect(city.coins).toBe(190);
  const rent = await handle.pool.query<{ rows: string; total: string }>(
    "select count(*)::text as rows, coalesce(sum(delta), 0)::text as total from inventory_ledger where city_id = $1 and source = 'rent_collected'",
    [session.cityId],
  );
  expect(rent.rows[0]).toEqual({ rows: "5", total: "160" });
  await assertLedgerReconciled(session.cityId);
});

test("a seventh cottage is rejected once population would pass the cap", async () => {
  const session = await guest();
  await handle.pool.query(
    `update cities set coins = 5000 where id = $1`,
    [session.cityId],
  );
  await handle.pool.query(
    `insert into inventory_ledger (city_id, resource, delta, balance_after, source)
     values ($1, 'COINS', 4250, 5000, 'integration_grant')`,
    [session.cityId],
  );
  const spots = [
    [0, 4],
    [2, 4],
    [0, 6],
    [2, 6],
    [0, 8],
    [2, 8],
    [0, 10],
  ] as const;
  for (const [index, [x, y]] of spots.entries()) {
    const placed = await command(session, "place-building", { definitionId: "B-001", x, y, rotation: 0 });
    if (index < 6) {
      expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
    } else {
      expect(placed.statusCode).toBe(422);
      expect(apiErrorSchema.parse(placed.json()).error.code).toBe("POP_CAP_REACHED");
    }
  }
  const city = await cityRow(session.cityId);
  expect(city.population).toBe(48);
  await assertLedgerReconciled(session.cityId);
});

test("US-003 starts, cancels, shifts, and collects a bakery job", async () => {
  const session = await guest();
  const harvested = await command(session, "collect-all", {});
  expect(harvested.statusCode, JSON.stringify(harvested.json())).toBe(200);
  expect(commandSuccessSchema.parse(harvested.json()).result).toMatchObject({ goods: { GOOD_WHEAT: 6 }, collected: 6 });
  const placed = await command(session, "place-building", { definitionId: "B-007", x: 0, y: 4, rotation: 0 });
  expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
  expect(commandSuccessSchema.parse(placed.json()).result).toMatchObject({ state: "ACTIVE", cost: 0 });
  const bakeryId = readString(asRecord(commandSuccessSchema.parse(placed.json()).result).instanceId);
  const started = await command(session, "start-production", { instanceId: bakeryId, recipeId: "RCP-BREAD" });
  expect(started.statusCode, JSON.stringify(started.json())).toBe(200);
  const firstJob = readString(asRecord(commandSuccessSchema.parse(started.json()).result).jobId);
  const queued = await command(session, "start-production", { instanceId: bakeryId, recipeId: "RCP-BREAD" });
  expect(queued.statusCode, JSON.stringify(queued.json())).toBe(200);
  const secondJob = readString(asRecord(commandSuccessSchema.parse(queued.json()).result).jobId);
  const cancelAt = now.getTime();
  const cancelled = await command(session, "cancel-production", { instanceId: bakeryId, jobId: firstJob });
  expect(cancelled.statusCode, JSON.stringify(cancelled.json())).toBe(200);
  const shifted = await handle.pool.query<{ started_at: Date; completes_at: Date; slot: number; cancelled_at: Date | null }>(
    "select started_at, completes_at, slot, cancelled_at from production_jobs where id = $1",
    [secondJob],
  );
  expect(shifted.rows[0]?.slot).toBe(0);
  expect(shifted.rows[0]?.cancelled_at).toBeNull();
  expect(shifted.rows[0]?.started_at.getTime()).toBe(cancelAt);
  expect(shifted.rows[0]?.completes_at.getTime()).toBe(cancelAt + 360_000);
  advance(360_000);
  const collected = await command(session, "collect", { instanceId: bakeryId });
  expect(collected.statusCode, JSON.stringify(collected.json())).toBe(200);
  expect(commandSuccessSchema.parse(collected.json()).result).toMatchObject({
    goods: { GOOD_BREAD: 3 },
    collected: 3,
    remaining: 0,
    warehouseFull: false,
    xp: 0,
  });
  const bread = await handle.pool.query<{ qty: number }>(
    "select qty from inventory_balances where city_id = $1 and good_id = 'GOOD_BREAD'",
    [session.cityId],
  );
  expect(bread.rows[0]?.qty).toBe(6);
  const wheat = await handle.pool.query<{ qty: number }>(
    "select qty from inventory_balances where city_id = $1 and good_id = 'GOOD_WHEAT'",
    [session.cityId],
  );
  expect(wheat.rows[0]?.qty).toBe(4);
  await assertLedgerReconciled(session.cityId);
});

test("US-004 keeps a ripe plot and caps passive commercial cycles at 12 hours", async () => {
  const session = await guest();
  const wheat = await handle.pool.query<{ id: string }>(
    "select id from building_instances where city_id = $1 and definition_id = 'AG-001' order by x",
    [session.cityId],
  );
  const plotId = wheat.rows[0]?.id;
  if (plotId === undefined) {
    throw new Error("starter wheat plot is missing");
  }
  await handle.pool.query("update building_instances set construction_completes_at = $2 where id = $1", [
    plotId,
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  ]);
  const waited = await acknowledge(session);
  expect(waited.statusCode).toBe(200);
  const stillReady = await handle.pool.query<{ state: string; qty: number | null }>(
    "select state, (output_ready->>'qty')::int as qty from building_instances where id = $1",
    [plotId],
  );
  expect(stillReady.rows[0]).toEqual({ state: "READY_TO_COLLECT", qty: 3 });
  const harvested = await command(session, "collect", { instanceId: plotId });
  expect(harvested.statusCode, JSON.stringify(harvested.json())).toBe(200);
  expect(commandSuccessSchema.parse(harvested.json()).result).toMatchObject({ goods: { GOOD_WHEAT: 3 }, collected: 3 });
  const replanted = await handle.pool.query<{ state: string; construction_completes_at: Date | null; qty: number | null }>(
    "select state, construction_completes_at, nullif(output_ready->>'qty', '')::int as qty from building_instances where id = $1",
    [plotId],
  );
  expect(replanted.rows[0]?.state).toBe("ACTIVE");
  expect(replanted.rows[0]?.qty).toBeNull();
  expect(replanted.rows[0]?.construction_completes_at?.getTime()).toBe(now.getTime() + 180_000);

  const grocery = await handle.pool.query<{ id: string }>(
    "select id from building_instances where city_id = $1 and definition_id = 'B-004'",
    [session.cityId],
  );
  const groceryId = grocery.rows[0]?.id;
  if (groceryId === undefined) {
    throw new Error("starter grocery is missing");
  }
  await handle.pool.query(
    `update building_instances
     set state = 'ACTIVE', cycle_started_at = $2, last_collected_at = $2,
         stock = $3::jsonb
     where id = $1`,
    [
      groceryId,
      now,
      JSON.stringify({ goods: { GOOD_BREAD: 300 }, pendingCoins: 0, tutorialCycle: false, tutorialUsed: true }),
    ],
  );
  advance(13 * 60 * 60 * 1000);
  const settled = await acknowledge(session);
  expect(settled.statusCode, JSON.stringify(settled.json())).toBe(200);
  const cappedCycles = Math.floor(PASSIVE_CAP_SECONDS / 600);
  const stock = await stockOf(groceryId);
  expect(stock.pendingCoins).toBe(cappedCycles * 110);
  expect(stock.goods.GOOD_BREAD).toBe(300 - cappedCycles * 3);
  expect(stock.cycleStartedAt).toBeNull();
  advance(60 * 60 * 1000);
  const second = await acknowledge(session);
  expect(second.statusCode).toBe(200);
  const unchanged = await stockOf(groceryId);
  expect(unchanged.pendingCoins).toBe(cappedCycles * 110);
  expect(unchanged.goods.GOOD_BREAD).toBe(300 - cappedCycles * 3);
  await assertLedgerReconciled(session.cityId);
});

test("US-009 replays one tutorial grocery collection for ten identical keys", async () => {
  const session = await guest();
  const grocery = await handle.pool.query<{ id: string }>(
    "select id from building_instances where city_id = $1 and definition_id = 'B-004'",
    [session.cityId],
  );
  const groceryId = grocery.rows[0]?.id;
  if (groceryId === undefined) {
    throw new Error("starter grocery is missing");
  }
  const supplied = await command(session, "supply-business", { instanceId: groceryId });
  expect(supplied.statusCode, JSON.stringify(supplied.json())).toBe(200);
  expect(commandSuccessSchema.parse(supplied.json()).result).toMatchObject({
    supplied: { GOOD_BREAD: 3 },
    projectedCoins: 110,
    cycleSeconds: 10,
    state: "ACTIVE",
  });
  advance(9_000);
  expect((await acknowledge(session)).statusCode).toBe(200);
  expect((await stockOf(groceryId)).pendingCoins).toBe(0);
  advance(1_000);
  expect((await acknowledge(session)).statusCode).toBe(200);
  expect((await stockOf(groceryId)).pendingCoins).toBe(110);
  const key = randomUUID();
  const responses = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    responses.push(await command(session, "collect", { instanceId: groceryId }, key));
  }
  for (const response of responses) {
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
  }
  const first = responses[0];
  if (first === undefined) {
    throw new Error("missing collect response");
  }
  expect(first.replayed).toBeUndefined();
  const body = commandSuccessSchema.parse(first.json());
  expect(body.result).toMatchObject({ coins: 110, xp: 0 });
  for (const response of responses.slice(1)) {
    expect(response.replayed).toBe("true");
    expect(response.json()).toEqual(first.json());
  }
  const credits = await handle.pool.query<{ rows: string; total: string }>(
    "select count(*)::text as rows, coalesce(sum(delta), 0)::text as total from inventory_ledger where city_id = $1 and source = 'sales_collected'",
    [session.cityId],
  );
  expect(credits.rows[0]).toEqual({ rows: "1", total: "110" });
  expect((await cityRow(session.cityId)).coins).toBe(860);
  await assertLedgerReconciled(session.cityId);
});

test("concurrent placement on one cell yields one success and one occupied delta", async () => {
  const session = await guest();
  const body = { definitionId: "B-001", x: 0, y: 4, rotation: 0 };
  const [left, right] = await Promise.all([
    command(session, "place-building", body, randomUUID(), 1),
    command(session, "place-building", body, randomUUID(), 1),
  ]);
  const responses = [left, right].sort((a, b) => a.statusCode - b.statusCode);
  expect(responses.map((response) => response.statusCode)).toEqual([200, 409]);
  const success = responses[0];
  const conflict = responses[1];
  if (success === undefined || conflict === undefined) {
    throw new Error("missing concurrent response");
  }
  const placed = commandSuccessSchema.parse(success.json());
  const error = apiErrorSchema.parse(conflict.json());
  expect(error.error.code).toBe("CELL_OCCUPIED");
  expect(error.cityVersion).toBe(2);
  expect(error.delta).toMatchObject({ fromVersion: 1, toVersion: 2 });
  const instanceId = readString(asRecord(placed.result).instanceId);
  expect(error.delta?.buildings.some((building) => building.id === instanceId)).toBe(true);
  const cottages = await handle.pool.query<{ count: string }>(
    "select count(*)::text as count from building_instances where city_id = $1 and definition_id = 'B-001' and removed_at is null",
    [session.cityId],
  );
  expect(cottages.rows[0]?.count).toBe("1");
  await assertLedgerReconciled(session.cityId);
});

test("a full warehouse collects only what fits and keeps the rest ready", async () => {
  const session = await guest();
  await handle.pool.query("update inventory_balances set qty = 38 where city_id = $1 and good_id = 'GOOD_BREAD'", [session.cityId]);
  await handle.pool.query(
    `insert into inventory_ledger (city_id, resource, delta, balance_after, source)
     values ($1, 'GOOD_BREAD', 35, 38, 'integration_fill')`,
    [session.cityId],
  );
  await handle.pool.query(
    `insert into quests (city_id, quest_id, period_key, track, status, step_index, step_state, version)
     values ($1, 'quest_early_bakery_01', '-', 'story', 'ACTIVE', 1, '{"0":1,"1":0}'::jsonb, 1)`,
    [session.cityId],
  );
  const placed = await command(session, "place-building", { definitionId: "B-007", x: 0, y: 4, rotation: 0 });
  expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
  const bakeryId = readString(asRecord(commandSuccessSchema.parse(placed.json()).result).instanceId);
  await handle.pool.query(
    `update building_instances set state = 'READY_TO_COLLECT', output_ready = '{"goodId":"GOOD_BREAD","qty":5}'::jsonb where id = $1`,
    [bakeryId],
  );
  const collected = await command(session, "collect-all", {});
  expect(collected.statusCode, JSON.stringify(collected.json())).toBe(200);
  expect(commandSuccessSchema.parse(collected.json()).result).toMatchObject({
    goods: { GOOD_BREAD: 2 },
    collected: 2,
    remaining: 9,
    warehouseFull: true,
  });
  const bread = await handle.pool.query<{ qty: number }>(
    "select qty from inventory_balances where city_id = $1 and good_id = 'GOOD_BREAD'",
    [session.cityId],
  );
  expect(bread.rows[0]?.qty).toBe(40);
  const output = await handle.pool.query<{ qty: number }>(
    "select (output_ready->>'qty')::int as qty from building_instances where id = $1",
    [bakeryId],
  );
  expect(output.rows[0]?.qty).toBe(3);
  const wheatLeft = await handle.pool.query<{ qty: number }>(
    "select coalesce(sum((output_ready->>'qty')::int), 0)::int as qty from building_instances where city_id = $1 and definition_id = 'AG-001'",
    [session.cityId],
  );
  expect(wheatLeft.rows[0]?.qty).toBe(6);
  await assertLedgerReconciled(session.cityId);
});

test("remove refunds half, undo lasts ten seconds, and softlocks stay", async () => {
  const session = await guest();
  const buildings = await handle.pool.query<{ id: string; definition_id: string }>(
    "select id, definition_id from building_instances where city_id = $1 and removed_at is null",
    [session.cityId],
  );
  const hall = buildings.rows.find((row) => row.definition_id === "B-009");
  const plots = buildings.rows.filter((row) => row.definition_id === "AG-001");
  if (hall === undefined || plots.length !== 2) {
    throw new Error("starter buildings are missing");
  }
  const townHall = await command(session, "remove-building", { instanceId: hall.id });
  expect(townHall.statusCode).toBe(422);
  expect(apiErrorSchema.parse(townHall.json()).error.code).toBe("TOWN_HALL");

  const placed = await command(session, "place-building", { definitionId: "AG-001", x: 0, y: 4, rotation: 0 });
  expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
  const plotId = readString(asRecord(commandSuccessSchema.parse(placed.json()).result).instanceId);
  expect((await cityRow(session.cityId)).coins).toBe(730);
  const removed = await command(session, "remove-building", { instanceId: plotId });
  expect(removed.statusCode, JSON.stringify(removed.json())).toBe(200);
  expect(commandSuccessSchema.parse(removed.json()).result).toMatchObject({ refund: 10 });
  expect((await cityRow(session.cityId)).coins).toBe(740);
  const occupied = await command(session, "place-building", { definitionId: "B-001", x: 0, y: 4, rotation: 0 });
  expect(occupied.statusCode, JSON.stringify(occupied.json())).toBe(200);
  const blocked = await command(session, "remove-building", { instanceId: plotId, undo: true });
  expect(blocked.statusCode).toBe(409);
  expect(apiErrorSchema.parse(blocked.json()).error.code).toBe("CELL_OCCUPIED");
  expect((await cityRow(session.cityId)).coins).toBe(740);

  const cottageId = readString(asRecord(commandSuccessSchema.parse(occupied.json()).result).instanceId);
  const moved = await command(session, "move-building", { instanceId: cottageId, x: 0, y: 8, rotation: 1 });
  expect(moved.statusCode, JSON.stringify(moved.json())).toBe(200);
  expect(commandSuccessSchema.parse(moved.json()).result).toMatchObject({ x: 0, y: 8, rotation: 1 });
  expect(typeof asRecord(commandSuccessSchema.parse(moved.json()).result).undoToken).toBe("string");
  expect((await cityRow(session.cityId)).coins).toBe(740);

  const restored = await command(session, "remove-building", { instanceId: plotId, undo: true });
  expect(restored.statusCode, JSON.stringify(restored.json())).toBe(200);
  expect((await cityRow(session.cityId)).coins).toBe(730);
  const removedAgain = await command(session, "remove-building", { instanceId: plotId });
  expect(removedAgain.statusCode, JSON.stringify(removedAgain.json())).toBe(200);
  advance(11_000);
  const expired = await command(session, "remove-building", { instanceId: plotId, undo: true });
  expect(expired.statusCode).toBe(409);
  expect(apiErrorSchema.parse(expired.json()).error.code).toBe("STATE_CHANGED");

  const firstPlot = plots[0];
  const secondPlot = plots[1];
  if (firstPlot === undefined || secondPlot === undefined) {
    throw new Error("starter wheat plots are missing");
  }
  const removedStarter = await command(session, "remove-building", { instanceId: firstPlot.id });
  expect(removedStarter.statusCode, JSON.stringify(removedStarter.json())).toBe(200);
  expect(commandSuccessSchema.parse(removedStarter.json()).result).toMatchObject({ refund: 10 });
  const lastWheat = await command(session, "remove-building", { instanceId: secondPlot.id });
  expect(lastWheat.statusCode).toBe(422);
  expect(apiErrorSchema.parse(lastWheat.json()).error.code).toBe("LAST_WHEAT_PLOT");
  await assertLedgerReconciled(session.cityId);
});

test("snapshot sinceVersion returns a delta inside the retention window and a full city outside it", async () => {
  const session = await guest();
  const full = await app.inject({
    method: "GET",
    url: `/v1/cities/${session.cityId}/snapshot?sinceVersion=0`,
    headers: { authorization: session.authorization },
  });
  expect(full.statusCode).toBe(200);
  const snapshot = snapshotSchema.parse(full.json());
  expect(snapshot.cells).toHaveLength(576);
  expect(snapshot.cityVersion).toBe(1);
  const placed = await command(session, "place-building", { definitionId: "B-001", x: 0, y: 4, rotation: 0 });
  expect(placed.statusCode).toBe(200);
  const instanceId = readString(asRecord(commandSuccessSchema.parse(placed.json()).result).instanceId);
  const deltaResponse = await app.inject({
    method: "GET",
    url: `/v1/cities/${session.cityId}/snapshot?sinceVersion=1`,
    headers: { authorization: session.authorization },
  });
  expect(deltaResponse.statusCode).toBe(200);
  const delta = deltaSchema.parse(deltaResponse.json());
  expect(delta.fromVersion).toBe(1);
  expect(delta.toVersion).toBe(2);
  expect(delta.buildings.map((building) => building.id)).toContain(instanceId);
  expect("cells" in asRecord(deltaResponse.json())).toBe(false);
  const current = await app.inject({
    method: "GET",
    url: `/v1/cities/${session.cityId}/snapshot?sinceVersion=2`,
    headers: { authorization: session.authorization },
  });
  expect(current.statusCode).toBe(200);
  expect(deltaSchema.parse(current.json()).buildings).toEqual([]);
  await handle.pool.query("update cities set updated_at = $2 where id = $1", [
    session.cityId,
    new Date(now.getTime() - 25 * 60 * 60 * 1000),
  ]);
  const stale = await app.inject({
    method: "GET",
    url: `/v1/cities/${session.cityId}/snapshot?sinceVersion=1`,
    headers: { authorization: session.authorization },
  });
  expect(stale.statusCode).toBe(200);
  expect(snapshotSchema.parse(stale.json()).cells).toHaveLength(576);
  await assertLedgerReconciled(session.cityId);
});

function advance(milliseconds: number): void {
  now = new Date(now.getTime() + milliseconds);
}

async function guest(): Promise<{ authorization: string; cityId: string }> {
  const response = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  expect(response.statusCode).toBe(200);
  const body = asRecord(response.json());
  return { authorization: `Bearer ${readString(body.token)}`, cityId: readString(body.cityId) };
}

async function command(
  session: { authorization: string; cityId: string },
  name: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  cityVersion?: number,
): Promise<{ statusCode: number; json: () => unknown; replayed: unknown }> {
  const response = await app.inject({
    method: "POST",
    url: `/v1/cities/${session.cityId}/commands/${name}`,
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": key,
      ...(cityVersion === undefined ? {} : { "x-city-version": String(cityVersion) }),
    },
    payload: body,
  });
  return { statusCode: response.statusCode, json: () => response.json(), replayed: response.headers["idempotent-replay"] };
}

async function acknowledge(session: { authorization: string; cityId: string }): Promise<{ statusCode: number; json: () => unknown }> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    payload: { type: "acknowledge", note: "settle" },
  });
  return { statusCode: response.statusCode, json: () => response.json() };
}

async function cityRow(cityId: string): Promise<{ population: number; population_cap: number; coins: number; xp: number; version: number }> {
  const result = await handle.pool.query<{ population: number; population_cap: number; coins: string; xp: string; version: string }>(
    "select population, population_cap, coins::text, xp::text, version::text from cities where id = $1",
    [cityId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error("city is missing");
  }
  return {
    population: row.population,
    population_cap: row.population_cap,
    coins: Number(row.coins),
    xp: Number(row.xp),
    version: Number(row.version),
  };
}

async function stockOf(buildingId: string): Promise<{ pendingCoins: number; goods: { GOOD_BREAD?: number }; cycleStartedAt: Date | null }> {
  const result = await handle.pool.query<{ stock: { pendingCoins?: number; goods?: { GOOD_BREAD?: number } }; cycle_started_at: Date | null }>(
    "select stock, cycle_started_at from building_instances where id = $1",
    [buildingId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error("building is missing");
  }
  return { pendingCoins: row.stock.pendingCoins ?? 0, goods: row.stock.goods ?? {}, cycleStartedAt: row.cycle_started_at };
}

async function assertLedgerReconciled(cityId: string): Promise<void> {
  const ledger = await handle.pool.query<{ resource: string; total: string }>(
    "select resource, sum(delta)::text as total from inventory_ledger where city_id = $1 group by resource",
    [cityId],
  );
  const city = await handle.pool.query<{ coins: string; xp: string; gems: number; civic_stars: number }>(
    "select coins::text, xp::text, gems, civic_stars from cities where id = $1",
    [cityId],
  );
  const balances = await handle.pool.query<{ good_id: string; qty: number }>(
    "select good_id, qty from inventory_balances where city_id = $1",
    [cityId],
  );
  const totals = new Map(ledger.rows.map((row) => [row.resource, Number(row.total)]));
  const row = city.rows[0];
  if (row === undefined) {
    throw new Error("city is missing");
  }
  expect(totals.get("COINS") ?? 0).toBe(Number(row.coins));
  expect(totals.get("XP") ?? 0).toBe(Number(row.xp));
  expect(totals.get("GEMS") ?? 0).toBe(row.gems);
  expect(totals.get("CIVIC_STARS") ?? 0).toBe(row.civic_stars);
  for (const [resource, total] of totals) {
    if (resource === "COINS" || resource === "XP" || resource === "GEMS" || resource === "CIVIC_STARS") {
      continue;
    }
    expect(balances.rows.find((balance) => balance.good_id === resource)?.qty ?? 0).toBe(total);
  }
  for (const balance of balances.rows) {
    expect(totals.get(balance.good_id) ?? 0).toBe(balance.qty);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object");
  }
  return Object.fromEntries(Object.entries(value));
}

function readString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("expected a string");
  }
  return value;
}
