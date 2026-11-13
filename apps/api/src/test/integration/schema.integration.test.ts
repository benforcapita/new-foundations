import { randomUUID } from "node:crypto";
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
    "0004_lld_section4.sql",
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

test("LLD section 4 columns, keys, and checks are installed", async () => {
  const columns = await handle.pool.query<{ table_name: string; column_name: string; data_type: string; column_default: string | null }>(
    `select table_name, column_name, data_type, column_default
     from information_schema.columns
     where table_schema = 'public'`,
  );
  const byTable = new Map<string, Map<string, { data_type: string; column_default: string | null }>>();
  for (const row of columns.rows) {
    const table = byTable.get(row.table_name) ?? new Map();
    table.set(row.column_name, { data_type: row.data_type, column_default: row.column_default });
    byTable.set(row.table_name, table);
  }
  const column = (table: string, name: string) => {
    const found = byTable.get(table)?.get(name);
    if (found === undefined) {
      throw new Error(`${table}.${name} is missing`);
    }
    return found;
  };

  expect(column("cities", "id").data_type).toBe("uuid");
  expect(column("cities", "npc_key").data_type).toBe("text");
  expect(column("cities", "last_free_reroll_at").data_type).toBe("timestamp with time zone");
  expect(column("cities", "unlocked_bounds").data_type).toBe("jsonb");
  expect(column("cities", "collect_priority").data_type).toBe("text");
  expect(column("cities", "collect_priority").column_default).toContain("QUEST_FIRST");
  expect(column("cities", "coins").data_type).toBe("bigint");
  expect(column("cities", "xp").data_type).toBe("bigint");
  expect(column("cities", "version").data_type).toBe("bigint");
  expect(column("cities", "version").column_default).toContain("1");
  expect(column("cities", "updated_at").data_type).toBe("timestamp with time zone");
  expect(byTable.get("cities")?.has("catalog_id")).toBe(false);

  expect(column("building_instances", "id").data_type).toBe("uuid");
  expect(column("building_instances", "construction_completes_at").data_type).toBe("timestamp with time zone");
  expect(column("building_instances", "upgrade_completes_at").data_type).toBe("timestamp with time zone");
  expect(column("building_instances", "stock").data_type).toBe("jsonb");
  expect(column("building_instances", "output_ready").data_type).toBe("jsonb");
  expect(column("building_instances", "removed_at").data_type).toBe("timestamp with time zone");
  expect(column("building_instances", "undo_expires_at").data_type).toBe("timestamp with time zone");
  expect(byTable.get("building_instances")?.has("pending_output")).toBe(false);

  expect(column("production_jobs", "id").data_type).toBe("uuid");
  expect(column("production_jobs", "inputs").data_type).toBe("jsonb");
  expect(column("production_jobs", "outputs").data_type).toBe("jsonb");
  expect(column("production_jobs", "version").data_type).toBe("bigint");

  expect(column("order_instances", "id").data_type).toBe("uuid");
  expect(column("train_shipments", "id").data_type).toBe("uuid");
  expect(column("train_shipments", "completion_bonus_paid").data_type).toBe("boolean");
  expect(column("train_shipments", "help_request_at").data_type).toBe("timestamp with time zone");
  expect(column("train_shipments", "version").data_type).toBe("bigint");
  expect(column("franchises", "id").data_type).toBe("uuid");
  expect(column("franchises", "host_plot").data_type).toBe("jsonb");
  expect(column("franchises", "is_trial").data_type).toBe("boolean");
  expect(column("franchises", "last_supply_day").data_type).toBe("date");
  expect(column("franchises", "stock_cycles").data_type).toBe("smallint");
  expect(column("franchises", "cycle_started_at").data_type).toBe("timestamp with time zone");

  expect(column("sessions", "token_hash").data_type).toBe("bytea");
  expect(column("sessions", "last_seen_at").data_type).toBe("timestamp with time zone");
  expect(column("sessions", "revoked_at").data_type).toBe("timestamp with time zone");

  expect(column("inventory_ledger", "resource").data_type).toBe("text");
  expect(column("inventory_ledger", "balance_after").data_type).toBe("bigint");
  expect(column("inventory_ledger", "ref_type").data_type).toBe("text");
  expect(column("inventory_ledger", "ref_id").data_type).toBe("uuid");
  expect(column("inventory_ledger", "delta").data_type).toBe("bigint");
  expect(byTable.get("inventory_ledger")?.has("good_id")).toBe(false);

  expect(column("quests", "period_key").data_type).toBe("text");
  expect(column("quests", "track").data_type).toBe("text");
  expect(column("npc_visits", "window_started_at").data_type).toBe("timestamp with time zone");
  expect(column("npc_visits", "actions_used").data_type).toBe("smallint");
  expect(column("franchise_shipments", "command_id").data_type).toBe("uuid");

  const checks = await handle.pool.query<{ table_name: string; definition: string }>(
    `select conrelid::regclass::text as table_name, pg_get_constraintdef(oid) as definition
     from pg_constraint
     where contype = 'c' and connamespace = 'public'::regnamespace`,
  );
  const definitions = checks.rows.map((row) => `${row.table_name} ${row.definition}`);
  expect(definitions.some((line) => line.includes("inventory_ledger") && /delta <> 0/.test(line))).toBe(true);
  expect(definitions.some((line) => line.includes("order_instances") && line.includes("story") && line.includes("recovery"))).toBe(
    true,
  );
  expect(definitions.some((line) => line.includes("order_instances") && line.includes("REROLLED") && line.includes("REPLACED"))).toBe(
    true,
  );
  expect(definitions.some((line) => line.includes("building_instances") && line.includes("UNDER_CONSTRUCTION") && line.includes("RELOCATING"))).toBe(
    true,
  );
  expect(definitions.some((line) => line.includes("production_jobs") && line.includes("slot") && line.includes("0") && line.includes("2"))).toBe(
    true,
  );
  expect(definitions.some((line) => line.includes("franchises") && line.includes("DRAFT") && line.includes("TERMINATED"))).toBe(true);
  expect(definitions.some((line) => line.includes("franchise_shipments") && line.includes("SETTLED"))).toBe(true);

  const keys = await handle.pool.query<{ table_name: string; definition: string }>(
    `select conrelid::regclass::text as table_name, pg_get_constraintdef(oid) as definition
     from pg_constraint
     where contype in ('p', 'u') and connamespace = 'public'::regnamespace`,
  );
  const keyText = keys.rows.map((row) => `${row.table_name} ${row.definition}`).join("\n");
  expect(keyText).toContain("quests PRIMARY KEY (city_id, quest_id, period_key)");
  expect(keyText).toContain("npc_visits PRIMARY KEY (city_id, npc_city_id)");
  expect(keyText).toMatch(/franchise_shipments UNIQUE \(franchise_id, command_id\)/);
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
  expect(npcRows.map((row) => row.npcKey).sort()).toEqual(["amir_garden", "dana_city"]);
  expect(npcRows.every((row) => /^[0-9a-f-]{36}$/i.test(row.id))).toBe(true);

  const dana = npcRows.find((row) => row.npcKey === "dana_city");
  const amir = npcRows.find((row) => row.npcKey === "amir_garden");
  expect(dana).toMatchObject({ name: "Dana's City", isNpc: true, npcKey: "dana_city", collectPriority: "QUEST_FIRST" });
  expect(amir).toMatchObject({ name: "Amir's Garden", isNpc: true, npcKey: "amir_garden" });
  if (dana === undefined || amir === undefined) {
    throw new Error("npc cities were not seeded");
  }

  const danaCells = await handle.db.select().from(cityCells).where(eq(cityCells.cityId, dana.id));
  const amirCells = await handle.db.select().from(cityCells).where(eq(cityCells.cityId, amir.id));
  expect(danaCells).toHaveLength(16 * 16);
  expect(amirCells).toHaveLength(16 * 16);
  expect(danaCells.some((cell) => cell.cellRole === "franchise_plot")).toBe(true);
  expect(amirCells.some((cell) => cell.cellRole === "franchise_plot")).toBe(true);
  expect(amirCells.some((cell) => cell.terrainId === "grass_flowers")).toBe(true);
  expect(danaCells.some((cell) => cell.terrainId === "plaza")).toBe(true);

  const danaBuildings = await handle.db
    .select()
    .from(buildingInstances)
    .where(eq(buildingInstances.cityId, dana.id));
  expect(danaBuildings.map((building) => building.definitionId).sort()).toEqual(["B-004", "B-009"]);

  const amirBuildings = await handle.db
    .select()
    .from(buildingInstances)
    .where(eq(buildingInstances.cityId, amir.id));
  expect(amirBuildings.every((building) => building.definitionId === "AG-001")).toBe(true);
  expect(amirBuildings).toHaveLength(2);
  expect(amirBuildings.every((building) => building.outputReady.qty === 3)).toBe(true);

  const danaFootprint = await handle.db.select().from(buildingCells).where(eq(buildingCells.cityId, dana.id));
  expect(danaFootprint).toHaveLength(4 * 4 + 2 * 2);

  await seedNpcCities(handle.db);
  const after = await handle.db.select({ id: cities.id }).from(cities).where(eq(cities.isNpc, true));
  expect(after).toHaveLength(2);
});

test("building_cells reject overlapping footprints", async () => {
  const dana = await npcId("dana_city");
  const grocery = await handle.pool.query<{ id: string }>(
    "select id from building_instances where city_id = $1 and definition_id = 'B-004'",
    [dana],
  );
  const groceryId = grocery.rows[0]?.id;
  if (groceryId === undefined) {
    throw new Error("dana grocery is missing");
  }
  const client = await handle.pool.connect();
  try {
    await client.query("begin");
    await expect(
      client.query("insert into building_cells (city_id, x, y, building_id) values ($1, 2, 2, $2)", [dana, groceryId]),
    ).rejects.toThrow(/duplicate key|building_cells/i);
  } finally {
    await client.query("rollback");
    client.release();
  }
});

test("open orders, active trains, and open franchises keep their partial unique slots", async () => {
  const dana = await npcId("dana_city");
  const amir = await npcId("amir_garden");
  const client = await handle.pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into order_instances (
        id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
      ) values (
        $1, $2, 1, 'ORD-T-001', '[{"goodId":"GOOD_BREAD","qty":3}]'::jsonb,
        'OPEN', 'story', true, 180, 12, 1
      )`,
      [randomUUID(), dana],
    );
    await client.query(
      `insert into order_instances (
        id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
      ) values ($1, $2, 0, 'ORD-EASY-BREAD', '[]'::jsonb, 'OPEN', 'easy', true, 1, 1, 1)`,
      [randomUUID(), dana],
    );
    await expect(
      client.query(
        `insert into order_instances (
          id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
        ) values ($1, $2, 0, 'ORD-EASY-BREAD', '[]'::jsonb, 'OPEN', 'recovery', true, 1, 1, 1)`,
        [randomUUID(), dana],
      ),
    ).rejects.toThrow(/duplicate key|order_instances_open_slot/i);
  } finally {
    await client.query("rollback");
    client.release();
  }

  const closed = await handle.pool.connect();
  try {
    await closed.query("begin");
    await closed.query(
      `insert into order_instances (
        id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
      ) values ($1, $2, 2, 'ORD-T-001', '[]'::jsonb, 'REROLLED', 'story', true, 1, 1, 0)`,
      [randomUUID(), dana],
    );
    await closed.query(
      `insert into order_instances (
        id, city_id, slot, template_id, requirements, status, difficulty, solvable, reward_coins, reward_xp, civic_stars
      ) values ($1, $2, 2, 'ORD-T-001', '[]'::jsonb, 'REPLACED', 'recovery', true, 1, 1, 0)`,
      [randomUUID(), dana],
    );
  } finally {
    await closed.query("rollback");
    closed.release();
  }

  const train = await handle.pool.connect();
  try {
    await train.query("begin");
    await train.query(`insert into train_shipments (id, city_id, status) values ($1, $2, 'LOADING')`, [randomUUID(), amir]);
    await expect(
      train.query(`insert into train_shipments (id, city_id, status) values ($1, $2, 'IN_TRANSIT')`, [randomUUID(), amir]),
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
       values ($1, $2, $3, 'B-004', 'REQUESTED', 6000)`,
      [randomUUID(), dana, amir],
    );
    await expect(
      franchise.query(
        `insert into franchises (id, owner_city, host_city, business_definition_id, state, split_bps)
         values ($1, $2, $3, 'B-004', 'ACTIVE', 6000)`,
        [randomUUID(), dana, amir],
      ),
    ).rejects.toThrow(/duplicate key|franchises_one_open_business/i);
  } finally {
    await franchise.query("rollback");
    franchise.release();
  }

  const shipment = await handle.pool.connect();
  try {
    await shipment.query("begin");
    const franchiseId = randomUUID();
    await shipment.query(
      `insert into franchises (id, owner_city, host_city, business_definition_id, state, split_bps)
       values ($1, $2, $3, 'B-004', 'ACTIVE', 6000)`,
      [franchiseId, amir, dana],
    );
    await expect(
      shipment.query(
        `insert into franchise_shipments (id, franchise_id, command_id, owner_amount, host_amount, total_value, state)
         values ($1, $2, $3, 3, 2, 4, 'SETTLED')`,
        [randomUUID(), franchiseId, randomUUID()],
      ),
    ).rejects.toThrow(/franchise_shipments_split|check constraint/i);
  } finally {
    await shipment.query("rollback");
    shipment.release();
  }

  const duplicateCommand = await handle.pool.connect();
  try {
    await duplicateCommand.query("begin");
    const franchiseId = randomUUID();
    const commandId = randomUUID();
    await duplicateCommand.query(
      `insert into franchises (id, owner_city, host_city, business_definition_id, state, split_bps)
       values ($1, $2, $3, 'B-005', 'ACTIVE', 6000)`,
      [franchiseId, dana, amir],
    );
    await duplicateCommand.query(
      `insert into franchise_shipments (id, franchise_id, command_id, owner_amount, host_amount, total_value, state)
       values ($1, $2, $3, 3, 2, 5, 'SUPPLIED')`,
      [randomUUID(), franchiseId, commandId],
    );
    await expect(
      duplicateCommand.query(
        `insert into franchise_shipments (id, franchise_id, command_id, owner_amount, host_amount, total_value, state)
         values ($1, $2, $3, 1, 1, 2, 'READY')`,
        [randomUUID(), franchiseId, commandId],
      ),
    ).rejects.toThrow(/franchise_shipments_command_unique|duplicate key/i);
  } finally {
    await duplicateCommand.query("rollback");
    duplicateCommand.release();
  }
});

test("inventory_ledger rejects update, delete, and a zero delta", async () => {
  const dana = await npcId("dana_city");
  const client = await handle.pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into inventory_ledger (city_id, resource, delta, balance_after, source)
       values ($1, 'GOOD_BREAD', 3, 3, 'test')`,
      [dana],
    );
    await expect(client.query("update inventory_ledger set delta = 1 where source = 'test'")).rejects.toThrow(/append-only/);
  } finally {
    await client.query("rollback");
    client.release();
  }

  const deleter = await handle.pool.connect();
  try {
    await deleter.query("begin");
    await deleter.query(
      `insert into inventory_ledger (city_id, resource, delta, balance_after, source)
       values ($1, 'GOOD_BREAD', 3, 3, 'test-delete')`,
      [dana],
    );
    await expect(deleter.query("delete from inventory_ledger where source = 'test-delete'")).rejects.toThrow(/append-only/);
  } finally {
    await deleter.query("rollback");
    deleter.release();
  }

  const zero = await handle.pool.connect();
  try {
    await zero.query("begin");
    await expect(
      zero.query(
        `insert into inventory_ledger (city_id, resource, delta, balance_after, source)
         values ($1, 'COINS', 0, 0, 'test-zero')`,
        [dana],
      ),
    ).rejects.toThrow(/check constraint|delta/i);
  } finally {
    await zero.query("rollback");
    zero.release();
  }

  const remaining = await handle.db.execute(sql`select count(*)::int as count from inventory_ledger where source like 'test%'`);
  const count = remaining.rows[0]?.count;
  expect(Number(count ?? 0)).toBe(0);
});

async function npcId(npcKey: "dana_city" | "amir_garden"): Promise<string> {
  const rows = await handle.db.select({ id: cities.id }).from(cities).where(eq(cities.npcKey, npcKey)).limit(1);
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(`npc city ${npcKey} is missing`);
  }
  return id;
}
