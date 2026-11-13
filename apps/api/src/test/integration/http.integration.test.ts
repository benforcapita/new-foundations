import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { CONTENT_VERSION, ORDER_TEMPLATES, goodById, orderReward } from "@nf/shared";
import { apiErrorSchema, catalogResponseSchema, commandSuccessSchema, healthResponseSchema, snapshotSchema } from "@nf/shared/schemas";
import { buildApp } from "../../app";
import { sha256Bytes, sha256Hex } from "../../crypto";
import { lockCityIds, runCommand } from "../../plugins/idempotency";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";
import { inventoryBalances } from "../../db/schema";
import { seedNpcCities } from "../../db/seed/npcCities";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error(
    "DATABASE_URL is required for API integration tests. Start PostgreSQL 16 and export DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations.",
  );
}

const connectionString = databaseUrl;
let handle: DatabaseHandle;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  handle = createDatabase(connectionString);
  await migrate(handle.pool);
  await seedNpcCities(handle.db);
  app = buildApp({ logger: false, database: handle, corsOrigin: "https://play.example.com" });
});

afterAll(async () => {
  await app.close();
  await handle.pool.end();
});

test("health, catalog, and CORS headers", async () => {
  const health = await app.inject({
    method: "GET",
    url: "/healthz",
    headers: { origin: "http://localhost:5173" },
  });
  expect(health.statusCode).toBe(200);
  expect(healthResponseSchema.parse(health.json())).toEqual({ ok: true, db: "up", version: String(CONTENT_VERSION) });
  expect(health.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

  const preview = await app.inject({
    method: "OPTIONS",
    url: "/v1/content/catalog",
    headers: { origin: "https://new-foundations-git-main-ben.vercel.app", "access-control-request-method": "GET" },
  });
  expect(preview.statusCode).toBe(204);
  expect(preview.headers["access-control-allow-origin"]).toBe("https://new-foundations-git-main-ben.vercel.app");
  expect(preview.headers["access-control-allow-headers"]).toContain("Idempotency-Key");
  expect(preview.headers["access-control-allow-headers"]).toContain("X-Content-Version");
  expect(preview.headers["access-control-allow-headers"]).toContain("X-City-Version");

  const configured = await app.inject({
    method: "GET",
    url: "/healthz",
    headers: { origin: "https://play.example.com" },
  });
  expect(configured.headers["access-control-allow-origin"]).toBe("https://play.example.com");

  const blocked = await app.inject({
    method: "GET",
    url: "/healthz",
    headers: { origin: "https://evil.example" },
  });
  expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();

  const catalog = await app.inject({ method: "GET", url: "/v1/content/catalog?version=1" });
  expect(catalog.statusCode).toBe(200);
  expect(catalog.headers["cache-control"]).toBe("public, max-age=3600");
  const catalogBody = catalogResponseSchema.parse(catalog.json());
  expect(catalogBody.contentVersion).toBe(CONTENT_VERSION);
  expect(catalogBody.catalog).toMatchObject({ levels: expect.any(Array) });
  const levels = asRecord(catalogBody.catalog).levels;
  expect(Array.isArray(levels) ? levels : []).toHaveLength(15);
  const etag = catalog.headers.etag;
  expect(etag).toBe(`"content-${CONTENT_VERSION}"`);
  const cached = await app.inject({
    method: "GET",
    url: "/v1/content/catalog",
    headers: { "if-none-match": String(etag) },
  });
  expect(cached.statusCode).toBe(304);
});

test("guest session creates the starter city, resumes, and rotates on recovery", async () => {
  const created = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  expect(created.statusCode).toBe(200);
  const session = asRecord(created.json());
  const token = readString(session.token);
  const userId = readString(session.userId);
  const cityId = readString(session.cityId);
  const recoveryCode = readString(session.recoveryCode);
  expect(session.isNew).toBe(true);
  expect(token).toHaveLength(43);

  const tokenColumn = await handle.pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_name = 'sessions'",
  );
  expect(tokenColumn.rows.map((row) => row.column_name)).toContain("token_hash");
  expect(tokenColumn.rows.map((row) => row.column_name)).not.toContain("token");
  const stored = await handle.pool.query<{ token_hash: Buffer }>(
    "select token_hash from sessions where user_id = $1",
    [userId],
  );
  expect(Buffer.from(stored.rows[0]?.token_hash ?? [])).toEqual(sha256Bytes(token));
  const recovery = await handle.pool.query<{ recovery_code_hash: string }>(
    "select recovery_code_hash from users where id = $1",
    [userId],
  );
  expect(recovery.rows[0]?.recovery_code_hash).toBe(sha256Hex(recoveryCode));

  const ledger = await handle.pool.query<{ total: number; sources: string }>(
    `select coalesce(sum(delta), 0)::int as total, string_agg(source, ',') as sources
     from inventory_ledger where city_id = $1 and resource = 'GOOD_BREAD'`,
    [cityId],
  );
  expect(ledger.rows[0]?.total).toBe(3);
  expect(ledger.rows[0]?.sources).toBe("tutorial_grant");
  const coins = await handle.pool.query<{ total: number; city_coins: number }>(
    `select coalesce(sum(delta), 0)::int as total,
            (select coins from cities where id = $1)::int as city_coins
     from inventory_ledger where city_id = $1 and resource = 'COINS'`,
    [cityId],
  );
  expect(coins.rows[0]).toEqual({ total: 750, city_coins: 750 });
  const balance = await handle.db
    .select()
    .from(inventoryBalances)
    .where(eq(inventoryBalances.cityId, cityId));
  expect(balance).toMatchObject([{ cityId, goodId: "GOOD_BREAD", qty: 3 }]);

  const current = await app.inject({
    method: "GET",
    url: "/v1/cities/current",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(current.statusCode).toBe(200);
  const snapshot = snapshotSchema.parse(current.json());
  expect(snapshot.city).toMatchObject({
    cityId,
    coins: 750,
    warehouseCap: 40,
    warehouseTier: 0,
    level: 1,
    collectPriority: "QUEST_FIRST",
    contentVersion: CONTENT_VERSION,
  });
  expect(snapshot.inventory).toEqual({ GOOD_BREAD: 3 });
  expect(snapshot.cells).toHaveLength(24 * 24);
  expect(snapshot.train).toBeNull();
  expect(snapshot.contentVersion).toBe(CONTENT_VERSION);
  expect(snapshot.cityVersion).toBe(1);
  expect(snapshot.serverNow).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  const tutorial = await handle.pool.query<{ tutorial_state: { step: string; guideNpcId: string } }>(
    "select tutorial_state from cities where id = $1",
    [cityId],
  );
  expect(tutorial.rows[0]?.tutorial_state).toEqual({ step: "place_house", guideNpcId: "NPC-MIA" });

  expect(snapshot.buildings.find((building) => building.definitionId === "B-009")).toMatchObject({ state: "ACTIVE" });
  expect(snapshot.buildings.find((building) => building.definitionId === "B-004")).toMatchObject({ state: "NEEDS_SUPPLY" });
  const wheat = snapshot.buildings.filter((building) => building.definitionId === "AG-001");
  expect(wheat).toHaveLength(2);
  expect(wheat.every((plot) => plot.state === "READY_TO_COLLECT")).toBe(true);
  const wheatOutput = await handle.pool.query<{ output_ready: { goodId: string; qty: number } }>(
    "select output_ready from building_instances where city_id = $1 and definition_id = 'AG-001'",
    [cityId],
  );
  expect(wheatOutput.rows).toHaveLength(2);
  expect(wheatOutput.rows.every((row) => row.output_ready.goodId === "GOOD_WHEAT" && row.output_ready.qty === 3)).toBe(
    true,
  );

  expect(snapshot.orders).toHaveLength(3);
  const seedBread = ORDER_TEMPLATES.find((template) => template.id === "ORD-T-001");
  const easyBread = ORDER_TEMPLATES.find((template) => template.id === "ORD-EASY-BREAD");
  if (seedBread === undefined || easyBread === undefined) {
    throw new Error("starter order templates are missing from the catalog");
  }
  const wheatGood = goodById("GOOD_WHEAT");
  const wheatReward = orderReward([{ qty: 3, value: wheatGood.value }], "easy");
  expect(snapshot.orders.find((order) => order.slot === 0)).toMatchObject({
    templateId: "ORD-T-001",
    difficulty: seedBread.difficulty,
    status: "OPEN",
    requirements: { GOOD_BREAD: 3 },
    reward: { coins: seedBread.reward.coins, xp: seedBread.reward.xp, civicStars: 1 },
  });
  expect(snapshot.orders.find((order) => order.templateId === "ORD-EASY-BREAD")).toMatchObject({
    difficulty: easyBread.difficulty,
    status: "OPEN",
    reward: { coins: easyBread.reward.coins, xp: easyBread.reward.xp, civicStars: 1 },
  });
  expect(snapshot.orders.find((order) => order.templateId === "ORD-EASY-WHEAT")).toMatchObject({
    difficulty: "easy",
    status: "OPEN",
    requirements: { GOOD_WHEAT: 3 },
    reward: { coins: wheatReward.coins, xp: wheatReward.xp, civicStars: wheatReward.civicStars },
  });
  const easy = snapshot.orders.filter((order) => order.templateId !== "ORD-T-001");
  expect(easy).toHaveLength(2);
  expect(easy.every((order) => order.difficulty === "easy" && order.status === "OPEN")).toBe(true);
  const solvable = await handle.pool.query<{ solvable: boolean }>(
    "select solvable from order_instances where city_id = $1 and template_id <> 'ORD-T-001'",
    [cityId],
  );
  expect(solvable.rows).toHaveLength(2);
  expect(solvable.rows.every((row) => row.solvable)).toBe(true);

  expect(snapshot.quests).toHaveLength(1);
  expect(snapshot.quests[0]).toMatchObject({
    questId: "quest_tutorial_house",
    track: "story",
    periodKey: "-",
    status: "ACTIVE",
    stepState: { "0": 0 },
  });

  const resumed = await app.inject({ method: "POST", url: "/v1/auth/session", payload: { token } });
  expect(resumed.statusCode).toBe(200);
  expect(resumed.json()).toEqual({ token, userId, cityId, isNew: false });

  const recovered = await app.inject({ method: "POST", url: "/v1/auth/session", payload: { recoveryCode } });
  expect(recovered.statusCode).toBe(200);
  const next = asRecord(recovered.json());
  expect(next).toMatchObject({ userId, cityId, isNew: false });
  expect(next.recoveryCode).toBeUndefined();
  expect(next.token).not.toBe(token);

  const retired = await app.inject({ method: "POST", url: "/v1/auth/session", payload: { token } });
  expect(retired.statusCode).toBe(401);
  expect(retired.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });

  const withNewToken = await app.inject({
    method: "GET",
    url: "/v1/cities/current",
    headers: { authorization: `Bearer ${readString(next.token)}` },
  });
  expect(withNewToken.statusCode).toBe(200);
});

test("command pipeline replays, rejects a reused key, and ignores a stale city version", async () => {
  const session = await guest();
  const missing = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: { authorization: session.authorization, "content-type": "application/json" },
    payload: { type: "acknowledge", note: "missing-key" },
  });
  expect(missing.statusCode).toBe(400);
  expect(apiErrorSchema.parse(missing.json()).error.code).toBe("VALIDATION");

  const key = randomUUID();
  const payload = { type: "acknowledge", note: "alpha" };
  const first = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": key,
      "x-city-version": "1",
    },
    payload,
  });
  expect(first.statusCode).toBe(200);
  expect(first.headers["idempotent-replay"]).toBeUndefined();
  expect(commandSuccessSchema.parse(first.json())).toMatchObject({
    cityVersion: 2,
    result: { note: "alpha", requestedCityVersion: 1 },
    delta: { fromVersion: 1, toVersion: 2, inventory: { GOOD_BREAD: 3 }, removedBuildingIds: [] },
  });

  const replay = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": key,
      "x-city-version": "1",
    },
    payload,
  });
  expect(replay.statusCode).toBe(200);
  expect(replay.headers["idempotent-replay"]).toBe("true");
  expect(replay.json()).toEqual(first.json());

  const reused = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": key,
    },
    payload: { type: "acknowledge", note: "beta" },
  });
  expect(reused.statusCode).toBe(422);
  expect(apiErrorSchema.parse(reused.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");

  const ledger = await handle.pool.query<{ total: number; rows: number }>(
    `select coalesce(sum(delta), 0)::int as total, count(*)::int as rows
     from inventory_ledger where city_id = $1 and resource = 'GOOD_BREAD'`,
    [session.cityId],
  );
  expect(ledger.rows[0]).toMatchObject({ total: 3, rows: 1 });

  const mismatchGuest = await guest();
  const mismatch = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: mismatchGuest.authorization,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      "x-city-version": "5",
    },
    payload: { type: "acknowledge", note: "stale" },
  });
  expect(mismatch.statusCode).toBe(200);
  const mismatchBody = commandSuccessSchema.parse(mismatch.json());
  expect(mismatchBody).toMatchObject({
    cityVersion: 2,
    result: { note: "stale", requestedCityVersion: 5 },
    delta: { fromVersion: 1, toVersion: 2 },
  });
  expect(mismatchBody.delta.city?.version).toBe(2);
  expect(mismatchBody.delta.city?.cityId).toBe(mismatchGuest.cityId);

  const wrongContent = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: mismatchGuest.authorization,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      "x-content-version": "999",
    },
    payload: { type: "acknowledge", note: "old-catalog" },
  });
  expect(wrongContent.statusCode).toBe(412);
  expect(apiErrorSchema.parse(wrongContent.json())).toMatchObject({
    error: { code: "CONTENT_VERSION_MISMATCH" },
    cityVersion: 0,
  });
});

test("lazy resolve frees a finished production slot inside the command transaction", async () => {
  const session = await guest();
  const grocery = await handle.pool.query<{ id: string }>(
    "select id from building_instances where city_id = $1 and definition_id = 'B-004'",
    [session.cityId],
  );
  const buildingId = grocery.rows[0]?.id;
  if (buildingId === undefined) {
    throw new Error("starter grocery is missing");
  }
  const jobId = randomUUID();
  await handle.pool.query(
    `insert into production_jobs (
      id, building_id, city_id, slot, recipe_id, inputs, outputs, started_at, completes_at, version
    ) values ($1, $2, $3, 0, 'RCP-BREAD', '{}'::jsonb, '{}'::jsonb, now() - interval '2 minutes', now() - interval '1 second', 1)`,
    [jobId, buildingId, session.cityId],
  );
  const response = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    payload: { type: "acknowledge", note: "resolve" },
  });
  expect(response.statusCode).toBe(200);
  const resolved = await handle.pool.query<{ moved_to_output_at: Date | null }>(
    "select moved_to_output_at from production_jobs where id = $1",
    [jobId],
  );
  expect(resolved.rows[0]?.moved_to_output_at).toBeInstanceOf(Date);
  await handle.pool.query(
    `insert into production_jobs (
      id, building_id, city_id, slot, recipe_id, inputs, outputs, started_at, completes_at, version
    ) values ($1, $2, $3, 0, 'RCP-BREAD', '{}'::jsonb, '{}'::jsonb, now(), now() + interval '1 minute', 1)`,
    [randomUUID(), buildingId, session.cityId],
  );
});

test("city row locks run in ascending city id order", async () => {
  const npcs = await handle.pool.query<{ id: string; npc_key: string }>(
    "select id, npc_key from cities where npc_key in ('dana_city', 'amir_garden')",
  );
  const dana = npcs.rows.find((row) => row.npc_key === "dana_city")?.id;
  const amir = npcs.rows.find((row) => row.npc_key === "amir_garden")?.id;
  if (dana === undefined || amir === undefined) {
    throw new Error("npc cities are missing");
  }
  const ordered = [dana, amir].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  await expect(lockCityIds(handle.db, [dana, amir, dana])).resolves.toEqual(ordered);
});

test("concurrent commands on one city each advance the city version", async () => {
  const session = await guest();
  const before = await handle.pool.query<{ version: string }>("select version::text as version from cities where id = $1", [
    session.cityId,
  ]);
  const start = Number(before.rows[0]?.version);
  const count = 4;
  const responses = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      app.inject({
        method: "POST",
        url: "/v1/cities/current/commands/acknowledge",
        headers: {
          authorization: session.authorization,
          "content-type": "application/json",
          "idempotency-key": randomUUID(),
        },
        payload: { type: "acknowledge", note: `parallel-${index}` },
      }),
    ),
  );
  expect(responses.every((response) => response.statusCode === 200)).toBe(true);
  const versions = responses.map((response) => commandSuccessSchema.parse(response.json()).cityVersion);
  expect(new Set(versions).size).toBe(count);
  const after = await handle.pool.query<{ version: string }>("select version::text as version from cities where id = $1", [
    session.cityId,
  ]);
  expect(Number(after.rows[0]?.version)).toBe(start + count);
});

test("a ledger-writing command records goods and coins balances", async () => {
  const session = await guest();
  const tokenHash = sha256Bytes(session.token);
  const actor = await handle.pool.query<{ id: string; user_id: string }>(
    "select id, user_id from sessions where token_hash = $1 and revoked_at is null",
    [tokenHash],
  );
  const row = actor.rows[0];
  if (row === undefined) {
    throw new Error("session is missing");
  }

  const breadDelta = 2;
  const coinDelta = 100;
  const commandId = randomUUID();
  const outcome = await runCommand(handle.db, {
    actorId: row.user_id,
    sessionId: row.id,
    cityId: session.cityId,
    cityIds: [session.cityId],
    commandId,
    requestHash: sha256Hex(commandId),
    fromVersion: 1,
    now: new Date(),
    cityLevel: 1,
    apply: () =>
      Promise.resolve({
        ledger: [
          { resource: "GOOD_BREAD", delta: breadDelta, source: "integration_grant" },
          { resource: "COINS", delta: coinDelta, source: "integration_grant" },
        ],
        result: { granted: true },
      }),
  });

  expect(outcome.replayed).toBe(false);
  expect(outcome.statusCode).toBe(200);
  expect(commandSuccessSchema.parse(outcome.body)).toMatchObject({
    cityVersion: 2,
    result: { granted: true },
    delta: { fromVersion: 1, toVersion: 2, inventory: { GOOD_BREAD: 3 + breadDelta } },
  });

  const written = await handle.pool.query<{ resource: string; delta: number; balance_after: number }>(
    `select resource, delta::int as delta, balance_after::int as balance_after
     from inventory_ledger
     where city_id = $1 and command_id = $2
     order by id`,
    [session.cityId, commandId],
  );
  expect(written.rows).toEqual([
    { resource: "GOOD_BREAD", delta: breadDelta, balance_after: 5 },
    { resource: "COINS", delta: coinDelta, balance_after: 850 },
  ]);

  const balances = await handle.db.select().from(inventoryBalances).where(eq(inventoryBalances.cityId, session.cityId));
  expect(balances).toMatchObject([{ cityId: session.cityId, goodId: "GOOD_BREAD", qty: 5 }]);

  const totals = await handle.pool.query<{
    bread_sum: number;
    bread_qty: number;
    bread_balance_after: number;
    coin_sum: number;
    city_coins: number;
    coin_balance_after: number;
  }>(
    `select
       (select coalesce(sum(delta), 0)::int from inventory_ledger where city_id = $1 and resource = 'GOOD_BREAD') as bread_sum,
       (select qty from inventory_balances where city_id = $1 and good_id = 'GOOD_BREAD') as bread_qty,
       (select balance_after::int from inventory_ledger where city_id = $1 and resource = 'GOOD_BREAD' order by id desc limit 1) as bread_balance_after,
       (select coalesce(sum(delta), 0)::int from inventory_ledger where city_id = $1 and resource = 'COINS') as coin_sum,
       (select coins::int from cities where id = $1) as city_coins,
       (select balance_after::int from inventory_ledger where city_id = $1 and resource = 'COINS' order by id desc limit 1) as coin_balance_after`,
    [session.cityId],
  );
  const total = totals.rows[0];
  expect(total).toEqual({
    bread_sum: 5,
    bread_qty: 5,
    bread_balance_after: 5,
    coin_sum: 850,
    city_coins: 850,
    coin_balance_after: 850,
  });
  expect(total?.bread_sum).toBe(total?.bread_qty);
  expect(total?.bread_balance_after).toBe(total?.bread_sum);
  expect(total?.coin_sum).toBe(total?.city_coins);
  expect(total?.coin_balance_after).toBe(total?.coin_sum);
});

test("a session with revoked_at set cannot authenticate", async () => {
  const session = await guest();
  const tokenHash = sha256Bytes(session.token);
  const revoked = await handle.pool.query<{ id: string }>(
    "update sessions set revoked_at = now() where token_hash = $1 returning id",
    [tokenHash],
  );
  expect(revoked.rows).toHaveLength(1);

  const current = await app.inject({
    method: "GET",
    url: "/v1/cities/current",
    headers: { authorization: session.authorization },
  });
  expect(current.statusCode).toBe(401);
  expect(apiErrorSchema.parse(current.json()).error.code).toBe("UNAUTHORIZED");

  const resumed = await app.inject({ method: "POST", url: "/v1/auth/session", payload: { token: session.token } });
  expect(resumed.statusCode).toBe(401);
  expect(apiErrorSchema.parse(resumed.json()).error.code).toBe("UNAUTHORIZED");

  const stillThere = await handle.pool.query<{ revoked_at: Date | null }>(
    "select revoked_at from sessions where id = $1",
    [revoked.rows[0]?.id],
  );
  expect(stillThere.rows[0]?.revoked_at).toBeInstanceOf(Date);
});

test("unknown routes use the error envelope", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/does-not-exist" });
  expect(response.statusCode).toBe(404);
  expect(apiErrorSchema.parse(response.json())).toMatchObject({
    error: { code: "NOT_FOUND" },
    cityVersion: 0,
  });
  expect(response.json()).not.toHaveProperty("message");
});

test("commands are limited to 20 in a burst and 600 per minute for a session", async () => {
  const session = await guest();
  const limited = buildApp({
    logger: false,
    database: handle,
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  try {
    const statuses: number[] = [];
    for (let index = 0; index < 21; index += 1) {
      const response = await limited.inject({
        method: "POST",
        url: "/v1/cities/current/commands/acknowledge",
        headers: {
          authorization: session.authorization,
          "content-type": "application/json",
          "idempotency-key": randomUUID(),
        },
        payload: { type: "acknowledge", note: `burst-${index}` },
      });
      statuses.push(response.statusCode);
      if (index === 0) {
        expect(response.headers["x-ratelimit-limit"]).toBe("600");
        expect(response.headers["x-ratelimit-burst"]).toBe("20");
      }
      if (index === 20) {
        expect(response.statusCode).toBe(429);
        expect(apiErrorSchema.parse(response.json()).error.code).toBe("RATE_LIMITED");
        expect(response.headers["retry-after"]).toBe("1");
        expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
      }
    }
    expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true);
  } finally {
    await limited.close();
  }
});

async function guest(): Promise<{ authorization: string; cityId: string; token: string }> {
  const response = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  expect(response.statusCode).toBe(200);
  const body = asRecord(response.json());
  const token = readString(body.token);
  return { authorization: `Bearer ${token}`, cityId: readString(body.cityId), token };
}


function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("expected a string");
  }
  return value;
}
