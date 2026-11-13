import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { CONTENT_VERSION } from "@nf/shared";
import { buildApp } from "../../app";
import { lockCityIds } from "../../plugins/idempotency";
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
  expect(health.json()).toEqual({ ok: true, db: "up", version: CONTENT_VERSION });
  expect(health.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

  const preview = await app.inject({
    method: "OPTIONS",
    url: "/v1/content/catalog",
    headers: { origin: "https://new-foundations-git-main-ben.vercel.app", "access-control-request-method": "GET" },
  });
  expect(preview.statusCode).toBe(204);
  expect(preview.headers["access-control-allow-origin"]).toBe("https://new-foundations-git-main-ben.vercel.app");
  expect(preview.headers["access-control-allow-headers"]).toContain("Idempotency-Key");

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
  expect(catalog.json()).toMatchObject({ contentVersion: CONTENT_VERSION, levelCount: 15 });
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
  const stored = await handle.pool.query<{ token_hash: string }>(
    "select token_hash from sessions where user_id = $1",
    [userId],
  );
  expect(stored.rows[0]?.token_hash).toBe(sha256(token));
  const recovery = await handle.pool.query<{ recovery_code_hash: string }>(
    "select recovery_code_hash from users where id = $1",
    [userId],
  );
  expect(recovery.rows[0]?.recovery_code_hash).toBe(sha256(recoveryCode));

  const ledger = await handle.pool.query<{ total: number; sources: string }>(
    `select coalesce(sum(delta), 0)::int as total, string_agg(source, ',') as sources
     from inventory_ledger where city_id = $1 and good_id = 'GOOD_BREAD'`,
    [cityId],
  );
  expect(ledger.rows[0]?.total).toBe(3);
  expect(ledger.rows[0]?.sources).toBe("tutorial_grant");
  const balance = await handle.db
    .select()
    .from(inventoryBalances)
    .where(eq(inventoryBalances.cityId, cityId));
  expect(balance).toEqual([{ cityId, goodId: "GOOD_BREAD", qty: 3 }]);

  const current = await app.inject({
    method: "GET",
    url: "/v1/cities/current",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(current.statusCode).toBe(200);
  const snapshot = asRecord(current.json());
  expect(snapshot.city).toMatchObject({
    id: cityId,
    coins: 750,
    warehouseCap: 40,
    warehouseTier: 0,
    level: 1,
    tutorialState: { step: "place_house", guideNpcId: "NPC-MIA" },
  });
  expect(snapshot.inventory).toEqual([{ goodId: "GOOD_BREAD", qty: 3 }]);
  expect(snapshot.cells).toHaveLength(24 * 24);
  expect(snapshot.train).toBeNull();
  expect(snapshot.contentVersion).toBe(CONTENT_VERSION);
  expect(snapshot.cityVersion).toBe(0);
  expect(typeof snapshot.serverNow).toBe("string");

  const buildings = asRecords(snapshot.buildings);
  expect(buildings.find((building) => building.definitionId === "B-009")).toMatchObject({ state: "ACTIVE" });
  expect(buildings.find((building) => building.definitionId === "B-004")).toMatchObject({ state: "NEEDS_SUPPLY" });
  const wheat = buildings.filter((building) => building.definitionId === "AG-001");
  expect(wheat).toHaveLength(2);
  expect(wheat.every((plot) => plot.state === "READY_TO_COLLECT")).toBe(true);
  for (const plot of wheat) {
    expect(plot.pendingOutput).toMatchObject({ goodId: "GOOD_WHEAT", qty: 3 });
  }

  const orders = asRecords(snapshot.orders);
  expect(orders).toHaveLength(3);
  expect(orders.find((order) => order.slot === 0)).toMatchObject({ templateId: "ORD-T-001", status: "OPEN" });
  const easy = orders.filter((order) => order.templateId !== "ORD-T-001");
  expect(easy).toHaveLength(2);
  expect(easy.every((order) => order.difficulty === "easy" && order.solvable === true && order.status === "OPEN")).toBe(
    true,
  );

  const quests = asRecords(snapshot.quests);
  expect(quests.map((quest) => quest.questId)).toEqual(
    expect.arrayContaining(["quest_flower_street", "quest_early_bakery_01", "quest_tutorial_house"]),
  );

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
  expect(missing.json()).toMatchObject({ error: { code: "VALIDATION" } });

  const key = randomUUID();
  const payload = { type: "acknowledge", note: "alpha" };
  const first = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": key,
      "x-city-version": "0",
    },
    payload,
  });
  expect(first.statusCode).toBe(200);
  expect(first.headers["idempotent-replay"]).toBeUndefined();
  expect(first.json()).toMatchObject({
    cityVersion: 1,
    contentVersion: CONTENT_VERSION,
    delta: { baseVersion: 0, version: 1, cityId: session.cityId },
  });

  const replay = await app.inject({
    method: "POST",
    url: "/v1/cities/current/commands/acknowledge",
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
      "idempotency-key": key,
      "x-city-version": "0",
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
  expect(reused.json()).toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REUSED" } });

  const ledger = await handle.pool.query<{ total: number; rows: number }>(
    `select coalesce(sum(delta), 0)::int as total, count(*)::int as rows
     from inventory_ledger where city_id = $1 and good_id = 'GOOD_BREAD'`,
    [session.cityId],
  );
  expect(ledger.rows[0]).toMatchObject({ total: 3, rows: 2 });

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
  expect(mismatch.json()).toMatchObject({
    cityVersion: 1,
    delta: { baseVersion: 5, version: 1 },
  });
  expect(mismatch.json()).not.toMatchObject({ error: { code: "VERSION_CONFLICT" } });
});

test("lazy resolve frees a finished production slot inside the command transaction", async () => {
  const session = await guest();
  const buildingId = `${session.cityId}:grocery`;
  await handle.pool.query(
    `insert into production_jobs (
      id, building_id, city_id, slot, recipe_id, started_at, completes_at
    ) values ($1, $2, $3, 0, 'RCP-BREAD', now() - interval '2 minutes', now() - interval '1 second')`,
    [`${session.cityId}:job`, buildingId, session.cityId],
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
    [`${session.cityId}:job`],
  );
  expect(resolved.rows[0]?.moved_to_output_at).toBeInstanceOf(Date);
  await handle.pool.query(
    `insert into production_jobs (
      id, building_id, city_id, slot, recipe_id, started_at, completes_at
    ) values ($1, $2, $3, 0, 'RCP-BREAD', now(), now() + interval '1 minute')`,
    [`${session.cityId}:job-2`, buildingId, session.cityId],
  );
});

test("city row locks run in ascending city id order", async () => {
  await expect(lockCityIds(handle.db, ["dana_city", "amir_garden", "dana_city"])).resolves.toEqual([
    "amir_garden",
    "dana_city",
  ]);
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
        expect(response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error("expected a JSON array");
  }
  return value.map((item) => asRecord(item));
}

function readString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("expected a string");
  }
  return value;
}
