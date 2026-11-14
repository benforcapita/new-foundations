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

test("warehouse grows by tiers, charges materials, and priority persists", async () => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  const command = (name: string, payload: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload });
  await handle.pool.query("update cities set coins = 10000 where id = $1", [session.cityId]);
  const first = await command("upgrade-warehouse", {});
  expect(first.statusCode).toBe(200);
  expect((await handle.pool.query("select warehouse_tier, warehouse_cap from cities where id = $1", [session.cityId])).rows[0]).toEqual({ warehouse_tier: 1, warehouse_cap: 60 });
  expect((await command("upgrade-warehouse", {})).statusCode).toBe(409);
  await handle.pool.query("insert into inventory_balances (city_id, good_id, qty, version) values ($1, 'GOOD_PLANKS', 28, 1)", [session.cityId]);
  for (let tier = 2; tier <= 5; tier++) {
    expect((await command("upgrade-warehouse", {})).statusCode).toBe(200);
    expect((await handle.pool.query("select warehouse_tier, warehouse_cap from cities where id = $1", [session.cityId])).rows[0]).toEqual({ warehouse_tier: tier, warehouse_cap: 40 + 20 * tier });
  }
  expect((await command("upgrade-warehouse", {})).statusCode).toBe(422);
  expect((await handle.pool.query("select qty from inventory_balances where city_id = $1 and good_id = 'GOOD_PLANKS'", [session.cityId])).rows[0].qty).toBe(0);
  expect((await command("set-collect-priority", { priority: "OLDEST_FIRST" })).statusCode).toBe(200);
  expect((await handle.pool.query("select collect_priority from cities where id = $1", [session.cityId])).rows[0]).toEqual({ collect_priority: "OLDEST_FIRST" });
});

test("building upgrade stays in progress until its timer completes", async () => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  const command = (name: string, payload: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload });
  await handle.pool.query("update cities set coins = 10000 where id = $1", [session.cityId]);
  const placed = await command("place-building", { definitionId: "B-001", x: 0, y: 4, rotation: 0 });
  const instanceId = (placed.json() as { result: { instanceId: string } }).result.instanceId;
  const upgrade = await command("upgrade-building", { instanceId });
  expect(upgrade.statusCode).toBe(200);
  const row = (await handle.pool.query("select state, level, upgrade_completes_at from building_instances where id = $1", [instanceId])).rows[0];
  expect(row.state).toBe("UPGRADING");
  expect(row.level).toBe(1);
  expect(row.upgrade_completes_at).toBeInstanceOf(Date);
  now = new Date(row.upgrade_completes_at.getTime() - 1);
  await command("collect-all", {});
  expect((await handle.pool.query("select level from building_instances where id = $1", [instanceId])).rows[0].level).toBe(1);
  now = new Date(row.upgrade_completes_at.getTime());
  await command("collect-all", {});
  expect((await handle.pool.query("select state, level from building_instances where id = $1", [instanceId])).rows[0]).toEqual({ state: "ACTIVE", level: 2 });
  now = new Date(now.getTime() + 480_000);
  expect((await command("collect", { instanceId })).json().result.coins).toBe(40);
  await handle.pool.query("insert into inventory_balances (city_id, good_id, qty, version) values ($1, 'GOOD_PLANKS', 2, 1) on conflict (city_id, good_id) do update set qty = 2", [session.cityId]);
  const finalUpgrade = await command("upgrade-building", { instanceId });
  expect(finalUpgrade.statusCode).toBe(200);
  now = new Date(now.getTime() + 60_000);
  await command("collect-all", {});
  expect((await handle.pool.query("select level from building_instances where id = $1", [instanceId])).rows[0].level).toBe(3);
  now = new Date(now.getTime() + 480_000);
  expect((await command("collect", { instanceId })).json().result.coins).toBe(48);
  expect((await command("upgrade-building", { instanceId })).statusCode).toBe(409);
});

test.each(["QUEST_FIRST", "OLDEST_FIRST"] as const)("%s collects the proper stack first and leaves overflow intact", async (priority) => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  const command = (name: string, payload: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload });
  const rows = await handle.pool.query<{ id: string }>("select id from building_instances where city_id = $1 and definition_id = 'AG-001' order by id", [session.cityId]);
  const [old, quest] = rows.rows;
  if (!old || !quest) throw new Error("starter plots missing");
  await handle.pool.query("update cities set warehouse_cap = 6 where id = $1", [session.cityId]);
  await handle.pool.query("update quests set status = 'CLAIMED' where city_id = $1", [session.cityId]);
  await handle.pool.query("update order_instances set requirements = '[{\"goodId\":\"GOOD_WHEAT\",\"qty\":3}]'::jsonb where city_id = $1 and status = 'OPEN'", [session.cityId]);
  await handle.pool.query("update building_instances set state = 'READY_TO_COLLECT', output_ready = $2, construction_completes_at = $3 where id = $1", [old.id, JSON.stringify({ goodId: "GOOD_TIMBER", qty: 3 }), new Date(now.getTime() - 2000)]);
  await handle.pool.query("update building_instances set state = 'READY_TO_COLLECT', output_ready = $2, construction_completes_at = $3 where id = $1", [quest.id, JSON.stringify({ goodId: "GOOD_WHEAT", qty: 3 }), new Date(now.getTime() - 1000)]);
  expect((await command("set-collect-priority", { priority })).statusCode).toBe(200);
  const result = await command("collect-all", {});
  expect(result.statusCode).toBe(200);
  expect(result.json().result).toMatchObject({ collected: 3, remaining: 3, warehouseFull: true, goods: priority === "QUEST_FIRST" ? { GOOD_WHEAT: 3 } : { GOOD_TIMBER: 3 } });
  const remaining = await handle.pool.query<{ output_ready: { qty?: number } }>("select output_ready from building_instances where id = $1", [priority === "QUEST_FIRST" ? old.id : quest.id]);
  expect(remaining.rows[0]?.output_ready.qty).toBe(3);
});

test("Town Hall upgrade charges resources and raises the cap only on completion", async () => {
  const session = (await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} })).json() as { token: string; cityId: string };
  const command = (name: string, payload: object) => app.inject({ method: "POST", url: `/v1/cities/${session.cityId}/commands/${name}`, headers: { authorization: `Bearer ${session.token}`, "idempotency-key": randomUUID() }, payload });
  const instanceId = (await handle.pool.query("select id from building_instances where city_id = $1 and definition_id = 'B-009'", [session.cityId])).rows[0].id as string;
  await handle.pool.query("update cities set coins = 399 where id = $1", [session.cityId]);
  const insufficient = await command("upgrade-building", { instanceId });
  expect(insufficient.statusCode).toBe(409);
  expect(insufficient.json()).toMatchObject({ error: { code: "INSUFFICIENT_GOODS" } });
  await handle.pool.query("update cities set coins = 1200 where id = $1", [session.cityId]);
  expect((await command("upgrade-building", { instanceId })).statusCode).toBe(200);
  let row = (await handle.pool.query("select state, level, upgrade_completes_at from building_instances where id = $1", [instanceId])).rows[0];
  expect(row).toMatchObject({ state: "UPGRADING", level: 1 });
  expect(row.upgrade_completes_at.getTime()).toBe(now.getTime() + 600_000);
  expect((await handle.pool.query("select coins, population_cap from cities where id = $1", [session.cityId])).rows[0]).toEqual({ coins: "800", population_cap: 50 });
  now = new Date(row.upgrade_completes_at.getTime() - 1);
  await command("collect-all", {});
  expect((await handle.pool.query("select population_cap from cities where id = $1", [session.cityId])).rows[0].population_cap).toBe(50);
  now = new Date(now.getTime() + 1);
  await command("collect-all", {});
  expect((await handle.pool.query("select population_cap from cities where id = $1", [session.cityId])).rows[0].population_cap).toBe(63);
  const noPlanks = await command("upgrade-building", { instanceId });
  expect(noPlanks.statusCode).toBe(409);
  expect(noPlanks.json()).toMatchObject({ error: { code: "INSUFFICIENT_GOODS" } });
  await handle.pool.query("insert into inventory_balances (city_id, good_id, qty, version) values ($1, 'GOOD_PLANKS', 2, 1) on conflict (city_id, good_id) do update set qty = 2", [session.cityId]);
  expect((await command("upgrade-building", { instanceId })).statusCode).toBe(200);
  row = (await handle.pool.query("select state, level, upgrade_completes_at from building_instances where id = $1", [instanceId])).rows[0];
  expect(row).toMatchObject({ state: "UPGRADING", level: 2 });
  expect(row.upgrade_completes_at.getTime()).toBe(now.getTime() + 1_200_000);
  expect((await handle.pool.query("select coins, population_cap from cities where id = $1", [session.cityId])).rows[0]).toEqual({ coins: "0", population_cap: 63 });
  expect((await handle.pool.query("select qty from inventory_balances where city_id = $1 and good_id = 'GOOD_PLANKS'", [session.cityId])).rows[0].qty).toBe(0);
  now = new Date(row.upgrade_completes_at.getTime());
  await command("collect-all", {});
  expect((await handle.pool.query("select population_cap from cities where id = $1", [session.cityId])).rows[0].population_cap).toBe(75);
});
