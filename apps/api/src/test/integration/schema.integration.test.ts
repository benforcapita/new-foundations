import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createDatabase, type DatabaseHandle } from "../../db/client";
import { migrate } from "../../db/migrate";
import { buildingCells, buildingInstances, cities, cityCells } from "../../db/schema";
import { seedNpcCities } from "../../db/seed/npcCities";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error(
    "DATABASE_URL is required for API integration tests. Start PostgreSQL 16 and export DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations.",
  );
}

let handle: DatabaseHandle;

beforeAll(async () => {
  handle = createDatabase(databaseUrl);
  await migrate(handle.pool);
  await seedNpcCities(handle.db);
});

afterAll(async () => {
  await handle.pool.end();
});

test("migrations apply once and stay idempotent on PostgreSQL 16", async () => {
  const version = await handle.pool.query<{ version: string }>("select version() as version");
  expect(version.rows[0]?.version).toContain("PostgreSQL 16");

  const first = await handle.pool.query<{ id: string }>("select id from schema_migrations order by id");
  expect(first.rows.map((row) => row.id)).toEqual([
    "0001_init.sql",
    "0002_inventory_ledger_append_only.sql",
    "0003_order_contract.sql",
  ]);

  const appliedAgain = await migrate(handle.pool);
  expect(appliedAgain).toEqual([]);

  const second = await handle.pool.query<{ id: string }>("select id from schema_migrations order by id");
  expect(second.rows.map((row) => row.id)).toEqual(first.rows.map((row) => row.id));

  const tables = await handle.pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  expect(tables.rows.map((row) => row.tablename)).toEqual(
    expect.arrayContaining([
      "users",
      "sessions",
      "cities",
      "city_cells",
      "building_instances",
      "building_cells",
      "inventory_balances",
      "inventory_ledger",
      "production_jobs",
      "order_instances",
      "train_shipments",
      "franchises",
      "franchise_shipments",
      "quests",
      "npc_visits",
      "command_dedup",
      "telemetry_events",
    ]),
  );
});

test("partial unique indexes and the franchise split check are installed", async () => {
  const indexes = await handle.pool.query<{ indexname: string; indexdef: string }>(
    "select indexname, indexdef from pg_indexes where schemaname = 'public'",
  );
  const byName = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef]));
  expect(byName.get("production_jobs_active_slot")).toMatch(/moved_to_output_at IS NULL/i);
  expect(byName.get("production_jobs_active_slot")).toMatch(/cancelled_at IS NULL/i);
  expect(byName.get("order_instances_open_slot")).toMatch(/status = 'OPEN'/i);
  expect(byName.get("train_shipments_one_active")).toMatch(/status <> 'ARRIVED'/i);
  expect(byName.get("franchises_one_open_business")).toMatch(/REQUESTED/);
  expect(byName.get("franchises_one_open_business")).toMatch(/PAUSED/);

  const check = await handle.pool.query<{ definition: string }>(
    "select pg_get_constraintdef(oid) as definition from pg_constraint where conname = 'franchise_shipments_split'",
  );
  expect(check.rows[0]?.definition).toMatch(/owner_amount \+ host_amount\) = total_value/);
});

test("NPC cities dana_city and amir_garden seed idempotently with layouts and host plots", async () => {
  await seedNpcCities(handle.db);

  const npcRows = await handle.db.select().from(cities).where(eq(cities.isNpc, true));
  const ids = npcRows.map((row) => row.id).sort();
  expect(ids).toEqual(["amir_garden", "dana_city"]);

  const dana = npcRows.find((row) => row.id === "dana_city");
  const amir = npcRows.find((row) => row.id === "amir_garden");
  expect(dana).toMatchObject({ name: "Dana's City", isNpc: true, catalogId: "NPC-CITY-DANA" });
  expect(amir).toMatchObject({ name: "Amir's Garden", isNpc: true, catalogId: "NPC-CITY-AMIR" });

  const danaCells = await handle.db.select().from(cityCells).where(eq(cityCells.cityId, "dana_city"));
  const amirCells = await handle.db.select().from(cityCells).where(eq(cityCells.cityId, "amir_garden"));
  expect(danaCells).toHaveLength(16 * 16);
  expect(amirCells).toHaveLength(16 * 16);
  expect(danaCells.some((cell) => cell.cellRole === "franchise_plot")).toBe(true);
  expect(amirCells.some((cell) => cell.cellRole === "franchise_plot")).toBe(true);
  expect(amirCells.some((cell) => cell.terrainId === "grass_flowers")).toBe(true);
  expect(danaCells.some((cell) => cell.terrainId === "plaza")).toBe(true);

  const danaBuildings = await handle.db
    .select()
    .from(buildingInstances)
    .where(eq(buildingInstances.cityId, "dana_city"));
  expect(danaBuildings.map((building) => building.definitionId).sort()).toEqual(["B-004", "B-009"]);

  const amirBuildings = await handle.db
    .select()
    .from(buildingInstances)
    .where(eq(buildingInstances.cityId, "amir_garden"));
  expect(amirBuildings.every((building) => building.definitionId === "AG-001")).toBe(true);
  expect(amirBuildings).toHaveLength(2);
  expect(amirBuildings.every((building) => building.pendingOutput?.qty === 3)).toBe(true);

  const danaFootprint = await handle.db.select().from(buildingCells).where(eq(buildingCells.cityId, "dana_city"));
  expect(danaFootprint).toHaveLength(4 * 4 + 2 * 2);

  await seedNpcCities(handle.db);
  const after = await handle.db.select({ id: cities.id }).from(cities).where(eq(cities.isNpc, true));
  expect(after).toHaveLength(2);
});

test("building_cells reject overlapping footprints", async () => {
  const client = await handle.pool.connect();
  try {
    await client.query("begin");
    await expect(
      client.query(
        "insert into building_cells (city_id, x, y, building_id) values ('dana_city', 2, 2, 'dana_city:grocery')",
      ),
    ).rejects.toThrow(/duplicate key|building_cells/i);
  } finally {
    await client.query("rollback");
    client.release();
  }
});

test("open orders, active trains, and open franchises keep their partial unique slots", async () => {
  const client = await handle.pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into order_instances (
        id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
      ) values (
        'ord-story', 'dana_city', 1, 'ORD-T-001', '[{"goodId":"GOOD_BREAD","qty":3}]'::jsonb,
        'OPEN', 'story', true, 180, 12, 1
      )`,
    );
    await client.query(
      `insert into order_instances (
        id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
      ) values ('ord-a', 'dana_city', 0, 'ORD-EASY-BREAD', '[]'::jsonb, 'OPEN', 'easy', true, 1, 1, 1)`,
    );
    await expect(
      client.query(
        `insert into order_instances (
          id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
        ) values ('ord-b', 'dana_city', 0, 'ORD-EASY-BREAD', '[]'::jsonb, 'OPEN', 'easy', true, 1, 1, 1)`,
      ),
    ).rejects.toThrow(/duplicate key|order_instances_open_slot/i);
  } finally {
    await client.query("rollback");
    client.release();
  }

  const train = await handle.pool.connect();
  try {
    await train.query("begin");
    await train.query(
      `insert into train_shipments (id, city_id, status) values ('train-a', 'amir_garden', 'LOADING')`,
    );
    await expect(
      train.query(`insert into train_shipments (id, city_id, status) values ('train-b', 'amir_garden', 'IN_TRANSIT')`),
    ).rejects.toThrow(/duplicate key|train_shipments_one_active/i);
  } finally {
    await train.query("rollback");
    train.release();
  }

  const franchise = await handle.pool.connect();
  try {
    await franchise.query("begin");
    await franchise.query(
      `insert into franchises (id, owner_city, host_city, business_definition_id, state, split_bps)
       values ('fr-a', 'dana_city', 'amir_garden', 'B-004', 'REQUESTED', 6000)`,
    );
    await expect(
      franchise.query(
        `insert into franchises (id, owner_city, host_city, business_definition_id, state, split_bps)
         values ('fr-b', 'dana_city', 'amir_garden', 'B-004', 'ACTIVE', 6000)`,
      ),
    ).rejects.toThrow(/duplicate key|franchises_one_open_business/i);
  } finally {
    await franchise.query("rollback");
    franchise.release();
  }

  const shipment = await handle.pool.connect();
  try {
    await shipment.query("begin");
    await shipment.query(
      `insert into franchises (id, owner_city, host_city, business_definition_id, state, split_bps)
       values ('fr-split', 'amir_garden', 'dana_city', 'B-004', 'ACTIVE', 6000)`,
    );
    await expect(
      shipment.query(
        `insert into franchise_shipments (id, franchise_id, owner_amount, host_amount, total_value, state)
         values ('ship-bad', 'fr-split', 3, 2, 4, 'SETTLED')`,
      ),
    ).rejects.toThrow(/franchise_shipments_split|check constraint/i);
  } finally {
    await shipment.query("rollback");
    shipment.release();
  }
});

test("inventory_ledger rejects update and delete", async () => {
  const client = await handle.pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into inventory_ledger (city_id, good_id, delta, source)
       values ('dana_city', 'GOOD_BREAD', 3, 'test')`,
    );
    await expect(client.query("update inventory_ledger set delta = 0 where source = 'test'")).rejects.toThrow(
      /append-only/,
    );
  } finally {
    await client.query("rollback");
    client.release();
  }

  const deleter = await handle.pool.connect();
  try {
    await deleter.query("begin");
    await deleter.query(
      `insert into inventory_ledger (city_id, good_id, delta, source)
       values ('dana_city', 'GOOD_BREAD', 3, 'test-delete')`,
    );
    await expect(deleter.query("delete from inventory_ledger where source = 'test-delete'")).rejects.toThrow(
      /append-only/,
    );
  } finally {
    await deleter.query("rollback");
    deleter.release();
  }

  const remaining = await handle.db.execute(sql`select count(*)::int as count from inventory_ledger where source like 'test%'`);
  const count = remaining.rows[0]?.count;
  expect(Number(count ?? 0)).toBe(0);
});
