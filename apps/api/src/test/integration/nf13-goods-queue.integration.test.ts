import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { LEVELS } from "@nf/shared";
import { buildApp } from "../../app";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
let db: DatabaseHandle;
let app: ReturnType<typeof buildApp>;
let now = new Date("2026-11-13T12:00:00Z");
type Session = { authorization: string; cityId: string };
beforeAll(async () => {
  db = createDatabase(url);
  await migrate(db.pool);
  app = buildApp({ logger: false, database: db, clock: () => now, rateLimit: { burst: 500, perMinute: 5000 } });
});
afterAll(async () => { await app.close(); await db.pool.end(); });
async function guest(level = 10): Promise<Session> {
  const response = await app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { token: string; cityId: string };
  await db.pool.query("update cities set level = $2, xp = $3, coins = 10000 where id = $1", [body.cityId, level, LEVELS.slice(0, level - 1).reduce((sum, item) => sum + (item.xpToNext ?? 0), 0)]);
  return { authorization: `Bearer ${body.token}`, cityId: body.cityId };
}
async function command(s: Session, name: string, payload: object) {
  return app.inject({ method: "POST", url: `/v1/cities/${s.cityId}/commands/${name}`, headers: { authorization: s.authorization, "idempotency-key": randomUUID() }, payload });
}
function result(response: Awaited<ReturnType<typeof command>>): Record<string, unknown> {
  expect(response.statusCode, response.body).toBe(200);
  return (response.json() as { result: Record<string, unknown> }).result;
}
function advance(seconds: number) { now = new Date(now.getTime() + seconds * 1000); }
async function place(s: Session, id: string) {
  return String(result(await command(s, "place-building", { definitionId: id, x: 0, y: 4, rotation: 0 })).instanceId);
}
async function grant(s: Session, good: string, qty: number) {
  await db.pool.query("insert into inventory_balances (city_id, good_id, qty) values ($1, $2, $3) on conflict (city_id, good_id) do update set qty = $3", [s.cityId, good, qty]);
}
async function balance(s: Session, good: string) {
  const rows = await db.pool.query<{ qty: number }>("select qty from inventory_balances where city_id = $1 and good_id = $2", [s.cityId, good]);
  return rows.rows[0]?.qty ?? 0;
}

test.each([
  ["AG-001", "GOOD_WHEAT", 180, 20, 1], ["AG-002", "GOOD_TIMBER", 300, 40, 4],
  ["AG-003", "GOOD_MILK", 480, 60, 5], ["AG-004", "GOOD_FLOWERS", 300, 40, 10],
])("%s grows, waits and replants", async (id, good, seconds, cost, level) => {
  const s = await guest(level);
  const placed = result(await command(s, "place-building", { definitionId: id, x: 0, y: 4, rotation: 0 }));
  expect(placed.cost).toBe(cost);
  const instanceId = String(placed.instanceId);
  const row = () => db.pool.query<{ state: string; construction_completes_at: Date }>("select state, construction_completes_at from building_instances where id = $1", [instanceId]);
  expect((await row()).rows[0]?.construction_completes_at.getTime()).toBe(now.getTime() + seconds * 1000);
  advance(seconds + 172800);
  expect(result(await command(s, "collect", { instanceId })).goods).toEqual({ [good]: 3 });
  expect((await row()).rows[0]?.construction_completes_at.getTime()).toBe(now.getTime() + seconds * 1000);
  advance(seconds);
  expect(result(await command(s, "collect", { instanceId })).goods).toEqual({ [good]: 3 });
});

test.each([["AG-002", 4], ["AG-003", 5], ["AG-004", 10]] as const)("%s rejects placement below its unlock level", async (id, level) => {
  const s = await guest(level - 1);
  const response = await command(s, "place-building", { definitionId: id, x: 0, y: 4, rotation: 0 });
  expect(response.statusCode).toBe(422);
  expect(response.json().error.code).toBe("LOCKED_BY_LEVEL");
});

test("only the last wheat plot is protected", async () => {
  const s = await guest();
  const rows = await db.pool.query<{ id: string }>("select id from building_instances where city_id = $1 and definition_id = 'AG-001' and removed_at is null", [s.cityId]);
  for (const row of rows.rows.slice(1)) expect((await command(s, "remove-building", { instanceId: row.id })).statusCode).toBe(200);
  const last = await command(s, "remove-building", { instanceId: rows.rows[0]?.id });
  expect(last.statusCode).toBe(422);
  expect(last.json().error.code).toBe("LAST_WHEAT_PLOT");
});

test.each([
  ["RCP-BREAD", "B-007", 1, 360, { GOOD_WHEAT: 2 }, "GOOD_BREAD", 3],
  ["RCP-PLANKS", "B-008", 4, 900, { GOOD_TIMBER: 3 }, "GOOD_PLANKS", 2],
  ["RCP-CHEESE", "B-007", 5, 720, { GOOD_MILK: 2 }, "GOOD_CHEESE", 2],
  ["RCP-PAINT", "B-008", 10, 1200, { GOOD_FLOWERS: 2 }, "GOOD_PAINT", 2],
  ["RCP-BOOKS", "B-008", 10, 1800, { GOOD_TIMBER: 2, GOOD_PAINT: 1 }, "GOOD_BOOKS", 2],
] as const)("%s debits inputs and produces its output", async (recipeId, host, level, seconds, inputs, output, qty) => {
  const s = await guest(level);
  const instanceId = await place(s, host);
  advance(600);
  for (const [good, amount] of Object.entries(inputs)) await grant(s, good, amount);
  if (level > 1) {
    await db.pool.query("update cities set level = $2 where id = $1", [s.cityId, level - 1]);
    const locked = await command(s, "start-production", { instanceId, recipeId });
    expect(locked.statusCode).toBe(422);
    expect(locked.json().error.code).toBe("LOCKED_BY_LEVEL");
    await db.pool.query("update cities set level = $2 where id = $1", [s.cityId, level]);
  }
  const started = result(await command(s, "start-production", { instanceId, recipeId }));
  expect(Date.parse(String(started.completesAt)) - Date.parse(String(started.startedAt))).toBe(seconds * 1000);
  for (const good of Object.keys(inputs)) expect(await balance(s, good)).toBe(0);
  advance(seconds);
  expect(result(await command(s, "collect", { instanceId })).goods).toEqual({ [output]: qty });
});

test.each([4, 5])("level %i queue runs sequentially, rejects overflow and refunds cancellation", async level => {
  const s = await guest(level);
  const instanceId = await place(s, "B-007");
  await db.pool.query("update cities set level = $2 where id = $1", [s.cityId, level]);
  await grant(s, "GOOD_WHEAT", 10);
  const jobs: Record<string, unknown>[] = [];
  for (let i = 0; i < (level === 5 ? 3 : 2); i++) jobs.push(result(await command(s, "start-production", { instanceId, recipeId: "RCP-BREAD" })));
  expect(jobs[1]?.startedAt).toBe(jobs[0]?.completesAt);
  if (jobs[2]) expect(jobs[2].startedAt).toBe(jobs[1]?.completesAt);
  expect((await command(s, "start-production", { instanceId, recipeId: "RCP-BREAD" })).statusCode).toBe(409);
  const before = await balance(s, "GOOD_WHEAT");
  result(await command(s, "cancel-production", { instanceId, jobId: jobs[0]?.jobId }));
  expect(await balance(s, "GOOD_WHEAT")).toBe(before + 2);
  const shifted = await db.pool.query<{ started_at: Date; slot: number }>("select started_at, slot from production_jobs where id = $1", [jobs[1]?.jobId]);
  expect(shifted.rows[0]?.started_at.getTime()).toBe(now.getTime());
  expect(shifted.rows[0]?.slot).toBe(0);
});


test("flowers become paint and then books", async () => {
  const s = await guest();
  const flowers = await place(s, "AG-004");
  const carpenter = String(result(await command(s, "place-building", { definitionId: "B-008", x: 0, y: 8, rotation: 0 })).instanceId);
  advance(600);
  expect(result(await command(s, "collect", { instanceId: flowers })).goods).toEqual({ GOOD_FLOWERS: 3 });
  await grant(s, "GOOD_TIMBER", 2);
  result(await command(s, "start-production", { instanceId: carpenter, recipeId: "RCP-PAINT" }));
  advance(1200);
  expect(result(await command(s, "collect", { instanceId: carpenter })).goods).toEqual({ GOOD_PAINT: 2 });
  result(await command(s, "start-production", { instanceId: carpenter, recipeId: "RCP-BOOKS" }));
  expect(await balance(s, "GOOD_PAINT")).toBe(1);
  advance(1800);
  expect(result(await command(s, "collect", { instanceId: carpenter })).goods).toEqual({ GOOD_BOOKS: 2 });
});

test.each([
  ["B-005", { GOOD_CHEESE: 2, GOOD_MILK: 2 }, 720],
  ["B-006", { GOOD_BOOKS: 6 }, 2100],
] as const)("%s accepts its specified supply", async (id, inputs, seconds) => {
  const s = await guest();
  const instanceId = await place(s, id);
  advance(seconds);
  for (const [good, amount] of Object.entries(inputs)) await grant(s, good, amount);
  result(await command(s, "supply-business", { instanceId }));
  for (const good of Object.keys(inputs)) expect(await balance(s, good)).toBe(0);
});

test("cancellation refunds only unfinished jobs, including when finished output is blocked", async () => {
  const s = await guest(5);
  const instanceId = await place(s, "B-007");
  await grant(s, "GOOD_WHEAT", 4);
  await grant(s, "GOOD_MILK", 2);
  const first = result(await command(s, "start-production", { instanceId, recipeId: "RCP-BREAD" }));
  expect(await balance(s, "GOOD_WHEAT")).toBe(2);
  result(await command(s, "cancel-production", { instanceId, jobId: first.jobId }));
  expect(await balance(s, "GOOD_WHEAT")).toBe(4);

  const bread = result(await command(s, "start-production", { instanceId, recipeId: "RCP-BREAD" }));
  const cheese = result(await command(s, "start-production", { instanceId, recipeId: "RCP-CHEESE" }));
  advance(360);
  const state = async () => ({
    jobs: (await db.pool.query("select * from production_jobs where building_id = $1 order by id", [instanceId])).rows,
    building: (await db.pool.query("select * from building_instances where id = $1", [instanceId])).rows,
    balances: (await db.pool.query("select * from inventory_balances where city_id = $1 order by good_id", [s.cityId])).rows,
    ledger: (await db.pool.query("select * from inventory_ledger where city_id = $1 order by id", [s.cityId])).rows,
  });
  const before = await state();
  const finished = await command(s, "cancel-production", { instanceId, jobId: bread.jobId });
  expect(finished.statusCode).toBe(409);
  expect(finished.json().error.code).toBe("PRODUCTION_FINISHED");
  expect(await state()).toEqual(before);

  advance(720);
  const waiting = await state();
  const rejected = await command(s, "cancel-production", { instanceId, jobId: cheese.jobId });
  expect(rejected.statusCode).toBe(409);
  expect(rejected.json().error.code).toBe("PRODUCTION_FINISHED");
  expect(await state()).toEqual(waiting);
  const job = await db.pool.query<{ moved_to_output_at: Date | null; cancelled_at: Date | null }>("select moved_to_output_at, cancelled_at from production_jobs where id = $1", [cheese.jobId]);
  expect(job.rows[0]).toMatchObject({ moved_to_output_at: null, cancelled_at: null });
  expect(await balance(s, "GOOD_MILK")).toBe(0);
});
