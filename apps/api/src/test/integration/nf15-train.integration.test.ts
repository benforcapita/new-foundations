import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildApp } from "../../app";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";
import { seedNpcCities } from "../../db/seed/npcCities";

let handle: DatabaseHandle;
let app: ReturnType<typeof buildApp>;
let now = new Date("2026-11-13T12:00:00Z");
beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  handle = createDatabase(process.env.DATABASE_URL);
  await migrate(handle.pool);
  await seedNpcCities(handle.db);
  app = buildApp({ logger: false, database: handle, clock: () => now, rateLimit: { burst: 500, perMinute: 5000 } });
});
afterAll(async () => { await app.close(); await handle.pool.end(); });

test("wagon retries pay once, completion pays once, and partial dispatch schedules a return", async () => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  const command = (name: string, payload: object, key = randomUUID()) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": key }, payload });
  await handle.pool.query("insert into building_instances (id, city_id, definition_id, x, y, state) values ($1, $2, 'B-011', 0, 0, 'ACTIVE')", [randomUUID(), session.cityId]);
  const wagons = Array.from({ length: 3 }, () => ({ goodId: "GOOD_WHEAT", qty: 3, filled: false, paid: false, reward: 54 }));
  await handle.pool.query("insert into train_shipments (id, city_id, status, wagons) values ($1, $2, 'LOADING', $3)", [randomUUID(), session.cityId, JSON.stringify(wagons)]);
  await handle.pool.query("insert into inventory_balances (city_id, good_id, qty, version) values ($1, 'GOOD_WHEAT', 18, 1) on conflict (city_id, good_id) do update set qty = 18", [session.cityId]);
  const before = Number((await handle.pool.query("select coins from cities where id = $1", [session.cityId])).rows[0].coins);
  const key = randomUUID();
  for (let i = 0; i < 10; i++) expect((await command("train-supply", { wagonIndex: 0, qty: 3 }, key)).statusCode).toBe(200);
  expect(Number((await handle.pool.query("select coins from cities where id = $1", [session.cityId])).rows[0].coins)).toBe(before + 54);
  expect((await command("train-supply", { wagonIndex: 1, qty: 3 })).statusCode).toBe(200);
  expect((await command("train-supply", { wagonIndex: 2, qty: 3 })).statusCode).toBe(200);
  expect((await command("train-supply", { wagonIndex: 2, qty: 3 })).statusCode).toBe(409);
  const city = (await handle.pool.query("select coins, civic_stars from cities where id = $1", [session.cityId])).rows[0];
  expect(Number(city.coins)).toBe(before + 162 + 41);
  expect(city.civic_stars).toBe(1);
  expect((await command("train-dispatch", {})).statusCode).toBe(200);
  const train = (await handle.pool.query("select status, returns_at from train_shipments where city_id = $1", [session.cityId])).rows[0];
  expect(train.status).toBe("IN_TRANSIT");
  expect(train.returns_at.getTime()).toBe(now.getTime() + 3_600_000);
});

test("a partially loaded train can dispatch without a completion bonus", async () => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  const command = (name: string, payload: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload });
  await handle.pool.query("insert into building_instances (id, city_id, definition_id, x, y, state) values ($1, $2, 'B-011', 0, 0, 'ACTIVE')", [randomUUID(), session.cityId]);
  const wagons = Array.from({ length: 3 }, () => ({ goodId: "GOOD_WHEAT", qty: 3, filled: false, paid: false, reward: 54 }));
  await handle.pool.query("insert into train_shipments (id, city_id, status, wagons) values ($1, $2, 'LOADING', $3)", [randomUUID(), session.cityId, JSON.stringify(wagons)]);
  await handle.pool.query("insert into inventory_balances (city_id, good_id, qty, version) values ($1, 'GOOD_WHEAT', 3, 1) on conflict (city_id, good_id) do update set qty = 3", [session.cityId]);
  expect((await command("train-supply", { wagonIndex: 0, qty: 3 })).statusCode).toBe(200);
  expect((await command("train-dispatch", {})).statusCode).toBe(200);
  const train = (await handle.pool.query("select status, returns_at, completion_bonus_paid from train_shipments where city_id = $1", [session.cityId])).rows[0];
  expect(train.status).toBe("IN_TRANSIT");
  expect(train.returns_at.getTime()).toBe(now.getTime() + 3_600_000);
  expect(train.completion_bonus_paid).toBe(false);
  expect((await handle.pool.query("select civic_stars from cities where id = $1", [session.cityId])).rows[0].civic_stars).toBe(0);
});


test("station generates a solvable shipment and replaces it only after return", async () => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  await handle.pool.query("update cities set level = 3 where id = $1", [session.cityId]);
  await handle.pool.query("insert into building_instances (id, city_id, definition_id, x, y, state) values ($1, $2, 'B-011', 0, 0, 'ACTIVE')", [randomUUID(), session.cityId]);
  const snapshot = () => app.inject({ method: "GET", url: `/v1/cities/${session.cityId}/snapshot`, headers: { authorization: `Bearer ${session.token}` } });
  const initial = (await snapshot()).json().train;
  expect(initial.wagons).toHaveLength(3);
  expect(initial.wagons.every((w: { goodId: string; qty: number }) => w.goodId === "GOOD_WHEAT" && w.qty === 3)).toBe(true);
  expect((await app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/train-dispatch`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload: {} })).statusCode).toBe(200);
  now = new Date(now.getTime() + 3_599_000);
  expect((await snapshot()).json().train.id).toBe(initial.id);
  now = new Date(now.getTime() + 1_000);
  const returned = (await snapshot()).json().train;
  expect(returned.id).not.toBe(initial.id);
  expect(returned.state).toBe("LOADING");
  now = new Date("2026-11-13T12:00:00Z");
});
