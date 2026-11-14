import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { DECORATIONS } from "@nf/shared";
import { buildApp } from "../../app";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";
import { seedNpcCities } from "../../db/seed/npcCities";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
let db: DatabaseHandle;
let app: ReturnType<typeof buildApp>;
let now = new Date("2026-11-13T12:00:00Z");
beforeAll(async () => { db = createDatabase(url); await migrate(db.pool); await seedNpcCities(db.db); app = buildApp({ logger: false, database: db, clock: () => now, rateLimit: { burst: 500, perMinute: 5000 } }); });
afterAll(async () => { await app.close(); await db.pool.end(); });

test("US-011 pays the unique decoration and adjacent road bonuses on collection", async () => {
  const sessionResponse = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  const session = sessionResponse.json() as { token: string; cityId: string };
  await db.pool.query("update cities set level = 4, xp = 390, coins = 10000 where id = $1", [session.cityId]);
  const command = (name: string, body: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload: body });
  for (const [definitionId, x, y] of [["D-001", 11, 4], ["D-001", 11, 5], ["R-001", 9, 6]] as const) {
    const placed = await command("place-building", { definitionId, x, y, rotation: 0 });
    expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
  }
  const grocery = await db.pool.query<{ id: string }>("select id from building_instances where city_id = $1 and definition_id = 'B-004'", [session.cityId]);
  const id = grocery.rows[0]?.id;
  if (!id) throw new Error("Missing grocery");
  await db.pool.query("update building_instances set state = 'ACTIVE', cycle_started_at = $2, last_collected_at = $2, stock = $3::jsonb where id = $1", [id, now, JSON.stringify({ goods: { GOOD_BREAD: 3 }, pendingCoins: 0, tutorialCycle: false, tutorialUsed: true })]);
  now = new Date(now.getTime() + 600_000);
  const before = await db.pool.query<{ coins: number }>("select coins from cities where id = $1", [session.cityId]);
  const collected = await command("collect", { instanceId: id });
  expect(collected.statusCode, JSON.stringify(collected.json())).toBe(200);
  const after = await db.pool.query<{ coins: number }>("select coins from cities where id = $1", [session.cityId]);
  expect(Number(after.rows[0]?.coins) - Number(before.rows[0]?.coins)).toBe(116);
});


test.each(["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007", "B-012"])("%s requires level 4 and can be placed at its catalog cost", async definitionId => {
  const response = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  const session = response.json() as { token: string; cityId: string };
  const place = () => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/place-building`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload: { definitionId, x: 0, y: 4, rotation: 0 } });
  await db.pool.query("update cities set level = 3, xp = 140, coins = 10000 where id = $1", [session.cityId]);
  expect((await place()).statusCode).not.toBe(200);
  await db.pool.query("update cities set level = 4, xp = 390 where id = $1", [session.cityId]);
  const placed = await place();
  expect(placed.statusCode, JSON.stringify(placed.json())).toBe(200);
  expect(placed.json().result.cost).toBe(definitionId === "B-012" ? 600 : 0);
  if (definitionId === "B-012") expect(placed.json().result.state).toBe("UNDER_CONSTRUCTION");
});

test("US-011 caps an artificially high set of unique catalog bonuses when collecting", async () => {
  const first = DECORATIONS.find(d => d.id === "D-001");
  const second = DECORATIONS.find(d => d.id === "D-002");
  if (!first || !second) throw new Error("Missing test definitions");
  const original = [first.boost, second.boost];
  Object.assign(first, { boost: 0.15 }); Object.assign(second, { boost: 0.15 });
  try {
    const response = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
    const session = response.json() as { token: string; cityId: string };
    await db.pool.query("update cities set level = 4, xp = 390, coins = 10000 where id = $1", [session.cityId]);
    const command = (name: string, body: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload: body });
    for (const [definitionId, y] of [["D-001", 4], ["D-002", 5]] as const) expect((await command("place-building", { definitionId, x: 11, y, rotation: 0 })).statusCode).toBe(200);
    const grocery = await db.pool.query<{ id: string }>("select id from building_instances where city_id = $1 and definition_id = 'B-004'", [session.cityId]);
    const id = grocery.rows[0]?.id;
    if (!id) throw new Error("Missing grocery");
    await db.pool.query("update building_instances set state = 'ACTIVE', cycle_started_at = $2, last_collected_at = $2, stock = $3::jsonb where id = $1", [id, now, JSON.stringify({ goods: { GOOD_BREAD: 3 }, pendingCoins: 0, tutorialCycle: false, tutorialUsed: true })]);
    now = new Date(now.getTime() + 600_000);
    const before = await db.pool.query<{ coins: number }>("select coins from cities where id = $1", [session.cityId]);
    expect((await command("collect", { instanceId: id })).statusCode).toBe(200);
    const after = await db.pool.query<{ coins: number }>("select coins from cities where id = $1", [session.cityId]);
    expect(Number(after.rows[0]?.coins) - Number(before.rows[0]?.coins)).toBe(132);
  } finally { Object.assign(first, { boost: original[0] }); Object.assign(second, { boost: original[1] }); }
});

test("park occupies its full 3x3 footprint for 300 seconds and road is available at level 1", async () => {
  const response = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  const session = response.json() as { token: string; cityId: string };
  const place = (definitionId: string, x: number, y: number) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/place-building`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload: { definitionId, x, y, rotation: 0 } });
  const road = await place("R-001", 0, 4);
  expect(road.statusCode).toBe(200);
  expect(road.json().result.cost).toBe(0);
  await db.pool.query("update cities set level = 4, xp = 390, coins = 10000 where id = $1", [session.cityId]);
  const park = await place("B-012", 1, 5);
  expect(park.statusCode, JSON.stringify(park.json())).toBe(200);
  const id = String(park.json().result.instanceId);
  const row = await db.pool.query<{ construction_completes_at: Date }>("select construction_completes_at from building_instances where id = $1", [id]);
  expect(row.rows[0]?.construction_completes_at.getTime()).toBe(now.getTime() + 300_000);
  const overlap = await place("D-001", 3, 7);
  expect(overlap.statusCode).not.toBe(200);
  expect((await place("D-001", 0, 8)).statusCode).toBe(200);
});
