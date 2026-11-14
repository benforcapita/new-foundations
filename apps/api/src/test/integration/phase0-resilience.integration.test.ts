import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildApp } from "../../app";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";
import { seedNpcCities } from "../../db/seed/npcCities";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
let db: DatabaseHandle;
let now = new Date("2026-11-13T12:00:00Z");
let app: ReturnType<typeof buildApp>;
const franchises: string[] = [];
beforeAll(async () => {
  db = createDatabase(url);
  await migrate(db.pool);
  await seedNpcCities(db.db);
  app = buildApp({ logger: false, database: db, clock: () => now, rateLimit: { burst: 500, perMinute: 5000 } });
});
afterAll(async () => {
  for (const id of franchises) await db.pool.query("delete from franchises where id = $1", [id]);
  await app.close();
  await db.pool.end();
});
async function guest() {
  const res = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  expect(res.statusCode).toBe(200);
  return res.json() as { token: string; cityId: string };
}
type Session = Awaited<ReturnType<typeof guest>>;
async function post(s: Session, path: string, payload: object, key = randomUUID(), headers: Record<string, string> = {}) {
  return app.inject({ method: "POST", url: path, headers: { authorization: `Bearer ${s.token}`, "idempotency-key": key, ...headers }, payload });
}
const path = (s: Session, name: string) => `/v1/cities/${s.cityId}/commands/${name}`;
async function state(ids: string[]) {
  const cities = await db.pool.query("select id, coins, xp, gems, civic_stars, version from cities where id = any($1) order by id", [ids]);
  const balances = await db.pool.query("select city_id, good_id, qty from inventory_balances where city_id = any($1) order by city_id, good_id", [ids]);
  const ledger = await db.pool.query("select * from inventory_ledger where city_id = any($1) order by id", [ids]);
  return { cities: cities.rows, balances: balances.rows, ledger: ledger.rows };
}
async function replay(s: Session, p: string, body: object, ids = [s.cityId], key = randomUUID()) {
  const first = await post(s, p, body, key);
  expect(first.statusCode, first.body).toBe(200);
  const after = await state(ids);
  for (let i = 0; i < 10; i++) {
    const again = await post(s, p, body, key);
    expect(again.statusCode, again.body).toBe(200);
    expect(again.headers["idempotent-replay"]).toBe("true");
    expect(again.json()).toEqual(first.json());
    expect(await state(ids)).toEqual(after);
  }
  return first.json() as { result: Record<string, unknown> };
}
async function reconcile(id: string) {
  const result = await db.pool.query<{ resource: string; total: string; expected: string }>(`with totals as (select resource, sum(delta)::text total from inventory_ledger where city_id=$1 group by resource), expected as (
    select 'COINS' resource, coins::text amount from cities where id=$1 union all select 'XP', xp::text from cities where id=$1 union all select 'GEMS', gems::text from cities where id=$1 union all select 'CIVIC_STARS', civic_stars::text from cities where id=$1 union all select good_id, qty::text from inventory_balances where city_id=$1)
    select coalesce(t.resource,e.resource) resource, coalesce(t.total,'0') total, coalesce(e.amount,'0') expected from totals t full join expected e using(resource)`, [id]);
  expect(result.rows.length).toBeGreaterThan(0);
  for (const row of result.rows) expect(Number(row.total), row.resource).toBe(Number(row.expected));
}
async function id(s: Session, definition: string) {
  const result = await db.pool.query<{ id: string }>("select id from building_instances where city_id=$1 and definition_id=$2 and removed_at is null order by x limit 1", [s.cityId, definition]);
  if (!result.rows[0]) throw new Error(`Missing ${definition}`);
  return result.rows[0].id;
}

test("each city command replays ten times without changing balances, ledger, or version", async () => {
  const s = await guest();
  const city = (name: string, body: object) => replay(s, path(s, name), body);
  const placed = await city("place-building", { definitionId: "B-001", x: 0, y: 4, rotation: 0 });
  const cottage = placed.result.instanceId as string;
  await city("move-building", { instanceId: cottage, x: 0, y: 8, rotation: 0 });
  await city("remove-building", { instanceId: cottage });
  await city("collect", { instanceId: await id(s, "AG-001") });
  await city("collect-all", {});
  await city("supply-business", { instanceId: await id(s, "B-004") });
  const bakery = await city("place-building", { definitionId: "B-007", x: 2, y: 4, rotation: 0 });
  const bakeryId = bakery.result.instanceId as string;
  const job = await city("start-production", { instanceId: bakeryId, recipeId: "RCP-BREAD" });
  await city("cancel-production", { instanceId: bakeryId, jobId: job.result.jobId });
  const order = await db.pool.query<{ id: string }>("select id from order_instances where city_id=$1 and status='OPEN' order by slot limit 1", [s.cityId]);
  await city("reroll-order", { orderId: order.rows[0]?.id });
  await db.pool.query("update cities set coins=1750, tutorial_state=$2::jsonb where id=$1", [s.cityId, JSON.stringify({ step: "tutorial_core_complete", guideNpcId: "NPC-MIA" })]);
  await db.pool.query("insert into inventory_ledger (city_id, resource, delta, balance_after, source) values ($1,'COINS',1000,1750,'phase0_setup')", [s.cityId]);
  await city("expand-land", { chunkX: 2, chunkY: 0 });
  await db.pool.query("insert into quests (city_id,quest_id,period_key,track,status,step_index,step_state,version) values ($1,'quest_early_bakery_01','-','story','COMPLETED',7,'{}',1) on conflict (city_id,quest_id,period_key) do update set status='COMPLETED'", [s.cityId]);
  await city("claim-quest", { questId: "quest_early_bakery_01", periodKey: "-" });
  await reconcile(s.cityId);
});

test("order and franchise commands survive replay and a disconnected session", async () => {
  const s = await guest();
  const order = await db.pool.query<{ id: string }>("select id from order_instances where city_id=$1 and template_id='ORD-T-001' and status='OPEN'", [s.cityId]);
  await replay(s, path(s, "fulfill-order"), { orderId: order.rows[0]?.id });
  const hosts = await app.inject({ method: "GET", url: "/v1/franchises/hosts", headers: { authorization: `Bearer ${s.token}` } });
  const host = (hosts.json() as { hosts: { cityId: string; plots: { plotId: string }[] }[] }).hosts.find(h => h.plots.length);
  if (!host) throw new Error("Missing NPC host");
  const requested = await replay(s, "/v1/franchises/request", { hostCityId: host.cityId, plotId: host.plots[0]?.plotId, businessDefinitionId: "B-004" }, [s.cityId, host.cityId]);
  const franchise = requested.result.franchiseId as string;
  franchises.push(franchise);
  await db.pool.query("update inventory_balances set qty=3 where city_id=$1 and good_id='GOOD_BREAD'", [s.cityId]);
  await db.pool.query("insert into inventory_ledger (city_id,resource,delta,balance_after,source) values ($1,'GOOD_BREAD',3,3,'phase0_setup')", [s.cityId]);
  const supplyKey = randomUUID();
  await replay(s, `/v1/franchises/${franchise}/supply`, { cycles: 1 }, [s.cityId, host.cityId], supplyKey);
  const beforeDisconnect = await state([s.cityId, host.cityId]);
  await app.close();
  app = buildApp({ logger: false, database: db, clock: () => now, rateLimit: { burst: 500, perMinute: 5000 } });
  const retry = await post(s, `/v1/franchises/${franchise}/supply`, { cycles: 1 }, supplyKey);
  expect(retry.statusCode).toBe(200);
  expect(retry.headers["idempotent-replay"]).toBe("true");
  expect(await state([s.cityId, host.cityId])).toEqual(beforeDisconnect);
  const resumed = await app.inject({ method: "GET", url: "/v1/cities/current", headers: { authorization: `Bearer ${s.token}` } });
  expect(resumed.statusCode).toBe(200);
  expect(resumed.json().franchises).toEqual(expect.arrayContaining([expect.objectContaining({ id: franchise })]));
  now = new Date(now.getTime() + 2_700_000);
  const collected = await replay(s, `/v1/franchises/${franchise}/collect`, {}, [s.cityId, host.cityId]);
  expect(collected.result).toMatchObject({ total: 110, ownerAmount: 66, hostAmount: 44 });
  await reconcile(s.cityId);
  await reconcile(host.cityId);
});

test("zero coins and an empty warehouse recover through a harvested order", async () => {
  const s = await guest();
  await db.pool.query("update cities set coins=0 where id=$1", [s.cityId]);
  await db.pool.query("update inventory_balances set qty=0 where city_id=$1", [s.cityId]);
  await db.pool.query("insert into inventory_ledger (city_id,resource,delta,balance_after,source) values ($1,'COINS',-750,0,'phase0_setup'),($1,'GOOD_BREAD',-3,0,'phase0_setup')", [s.cityId]);
  await db.pool.query(`update order_instances set requirements='[{"goodId":"GOOD_BREAD","qty":3}]'::jsonb where city_id=$1 and status='OPEN'`, [s.cityId]);
  const ack = await post(s, "/v1/cities/current/commands/acknowledge", { type: "acknowledge", note: "settle" });
  expect(ack.statusCode, ack.body).toBe(200);
  const order = await db.pool.query<{ id: string; requirements: unknown }>("select id,requirements from order_instances where city_id=$1 and template_id='ORD-RECOVERY' and status='OPEN'", [s.cityId]);
  expect(order.rows[0]?.requirements).toEqual([{ goodId: "GOOD_WHEAT", qty: 3 }]);
  const harvest = await post(s, path(s, "collect"), { instanceId: await id(s, "AG-001") });
  expect(harvest.statusCode, harvest.body).toBe(200);
  const fulfilled = await post(s, path(s, "fulfill-order"), { orderId: order.rows[0]?.id });
  expect(fulfilled.statusCode, fulfilled.body).toBe(200);
  const coins = await db.pool.query<{ coins: string }>("select coins::text from cities where id=$1", [s.cityId]);
  expect(Number(coins.rows[0]?.coins)).toBeGreaterThan(0);
  const build = await post(s, path(s, "place-building"), { definitionId: "AG-001", x: 0, y: 4, rotation: 0 });
  expect(build.statusCode, build.body).toBe(200);
  await reconcile(s.cityId);
});

test("client clock headers cannot accelerate server production", async () => {
  const s = await guest();
  const harvest = await post(s, path(s, "collect-all"), {});
  expect(harvest.statusCode).toBe(200);
  const placed = await post(s, path(s, "place-building"), { definitionId: "B-007", x: 0, y: 4, rotation: 0 });
  expect(placed.statusCode, placed.body).toBe(200);
  const bakery = placed.json().result.instanceId as string;
  const started = await post(s, path(s, "start-production"), { instanceId: bakery, recipeId: "RCP-BREAD" }, randomUUID(), { date: "Wed, 01 Jan 2099 00:00:00 GMT", "x-client-time": "2099-01-01T00:00:00Z" });
  expect(started.statusCode, started.body).toBe(200);
  const job = await db.pool.query<{ completes_at: Date }>("select completes_at from production_jobs where id=$1", [started.json().result.jobId]);
  expect(job.rows[0]?.completes_at.getTime()).toBe(now.getTime() + 360_000);
  const early = await post(s, path(s, "collect"), { instanceId: bakery }, randomUUID(), { date: "Wed, 01 Jan 2099 00:00:00 GMT", "x-client-time": "2099-01-01T00:00:00Z" });
  expect(early.statusCode, early.body).toBe(200);
  expect(early.json().result.collected).toBe(0);
  now = new Date(now.getTime() + 360_000);
  const done = await post(s, path(s, "collect"), { instanceId: bakery }, randomUUID(), { date: "Mon, 01 Jan 2001 00:00:00 GMT" });
  expect(done.statusCode, done.body).toBe(200);
  expect(done.json().result.goods).toEqual({ GOOD_BREAD: 3 });
  await reconcile(s.cityId);
});

test("production completing with a full warehouse retains its entire output", async () => {
  const s = await guest();
  expect((await post(s, path(s, "collect-all"), {})).statusCode).toBe(200);
  const placed = await post(s, path(s, "place-building"), { definitionId: "B-007", x: 0, y: 4, rotation: 0 });
  expect(placed.statusCode, placed.body).toBe(200);
  const bakery = placed.json().result.instanceId as string;
  expect((await post(s, path(s, "start-production"), { instanceId: bakery, recipeId: "RCP-BREAD" })).statusCode).toBe(200);
  const balance = await db.pool.query<{ qty: number }>("select qty from inventory_balances where city_id=$1 and good_id='GOOD_BREAD'", [s.cityId]);
  const wheat = await db.pool.query<{ qty: number }>("select qty from inventory_balances where city_id=$1 and good_id='GOOD_WHEAT'", [s.cityId]);
  const add = 40 - (balance.rows[0]?.qty ?? 0) - (wheat.rows[0]?.qty ?? 0);
  await db.pool.query("update inventory_balances set qty=qty+$2 where city_id=$1 and good_id='GOOD_BREAD'", [s.cityId, add]);
  await db.pool.query("insert into inventory_ledger (city_id,resource,delta,balance_after,source) values ($1,'GOOD_BREAD',$2,$3,'phase0_setup')", [s.cityId, add, (balance.rows[0]?.qty ?? 0) + add]);
  now = new Date(now.getTime() + 360_000);
  const collected = await post(s, path(s, "collect"), { instanceId: bakery });
  expect(collected.statusCode, collected.body).toBe(200);
  expect(collected.json().result).toMatchObject({ collected: 0, remaining: 3, warehouseFull: true });
  const output = await db.pool.query<{ qty: number }>("select (output_ready->>'qty')::int qty from building_instances where id=$1", [bakery]);
  expect(output.rows[0]?.qty).toBe(3);
  await reconcile(s.cityId);
});

test("starter and every seeded NPC city reconcile ledger to all balances", async () => {
  const s = await guest();
  const npcs = await db.pool.query<{ id: string }>("select id from cities where is_npc order by id");
  expect(npcs.rows.length).toBeGreaterThan(0);
  for (const city of [{ id: s.cityId }, ...npcs.rows]) await reconcile(city.id);
});
