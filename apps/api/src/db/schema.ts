import { sql } from "drizzle-orm";
import type { OrderDifficulty } from "@nf/shared";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const schemaMeta = pgTable("schema_meta", {
  id: text("id").primaryKey(),
  note: text("note").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  locale: text("locale").notNull().default("en"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  recoveryCodeHash: text("recovery_code_hash").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: bytea("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: integer("level").notNull().default(1),
    xp: bigint("xp", { mode: "number" }).notNull().default(0),
    coins: bigint("coins", { mode: "number" }).notNull().default(0),
    gems: integer("gems").notNull().default(0),
    civicStars: integer("civic_stars").notNull().default(0),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    contentVersion: integer("content_version").notNull(),
    population: integer("population").notNull().default(0),
    populationCap: integer("population_cap").notNull().default(0),
    warehouseTier: smallint("warehouse_tier").notNull().default(0),
    warehouseCap: integer("warehouse_cap").notNull().default(40),
    isNpc: boolean("is_npc").notNull().default(false),
    npcKey: text("npc_key").unique(),
    tutorialState: jsonb("tutorial_state").$type<{ step: string; guideNpcId: string } | null>(),
    unlockedBounds: jsonb("unlocked_bounds").$type<readonly (readonly number[])[]>().notNull().default([]),
    collectPriority: text("collect_priority").$type<"QUEST_FIRST" | "OLDEST_FIRST">().notNull().default("QUEST_FIRST"),
    lastFreeRerollAt: timestamp("last_free_reroll_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cities_one_player_city")
      .on(table.ownerId)
      .where(sql`${table.ownerId} is not null and ${table.isNpc} = false`),
  ],
);

export const cityCells = pgTable(
  "city_cells",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    x: smallint("x").notNull(),
    y: smallint("y").notNull(),
    terrainId: text("terrain_id").notNull(),
    ownerClaimed: boolean("owner_claimed").notNull().default(true),
    cellRole: text("cell_role").$type<"terrain" | "franchise_plot">().notNull().default("terrain"),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.x, table.y] })],
);

export const buildingInstances = pgTable("building_instances", {
  id: uuid("id").primaryKey(),
  cityId: uuid("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  definitionId: text("definition_id").notNull(),
  x: smallint("x").notNull(),
  y: smallint("y").notNull(),
  rotation: smallint("rotation").notNull().default(0),
  state: text("state").notNull(),
  level: smallint("level").notNull().default(1),
  constructionCompletesAt: timestamp("construction_completes_at", { withTimezone: true }),
  upgradeCompletesAt: timestamp("upgrade_completes_at", { withTimezone: true }),
  lastCollectedAt: timestamp("last_collected_at", { withTimezone: true }),
  cycleStartedAt: timestamp("cycle_started_at", { withTimezone: true }),
  stock: jsonb("stock").$type<Record<string, unknown>>().notNull().default({}),
  outputReady: jsonb("output_ready").$type<{ goodId?: string; qty?: number }>().notNull().default({}),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  undoExpiresAt: timestamp("undo_expires_at", { withTimezone: true }),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const buildingCells = pgTable(
  "building_cells",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    x: smallint("x").notNull(),
    y: smallint("y").notNull(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildingInstances.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.x, table.y] })],
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    goodId: text("good_id").notNull(),
    qty: integer("qty").notNull(),
    version: bigint("version", { mode: "number" }).notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.goodId] })],
);

export const inventoryLedger = pgTable("inventory_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cityId: uuid("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "restrict" }),
  resource: text("resource").notNull(),
  delta: bigint("delta", { mode: "number" }).notNull(),
  balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
  source: text("source").notNull(),
  commandId: uuid("command_id"),
  refType: text("ref_type"),
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productionJobs = pgTable(
  "production_jobs",
  {
    id: uuid("id").primaryKey(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildingInstances.id, { onDelete: "cascade" }),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    slot: smallint("slot").notNull(),
    recipeId: text("recipe_id").notNull(),
    inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull().default({}),
    outputs: jsonb("outputs").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completesAt: timestamp("completes_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    movedToOutputAt: timestamp("moved_to_output_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    version: bigint("version", { mode: "number" }).notNull().default(1),
  },
  (table) => [
    uniqueIndex("production_jobs_active_slot")
      .on(table.buildingId, table.slot)
      .where(sql`${table.movedToOutputAt} is null and ${table.cancelledAt} is null`),
  ],
);

export const orderInstances = pgTable(
  "order_instances",
  {
    id: uuid("id").primaryKey(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    slot: smallint("slot").notNull(),
    templateId: text("template_id").notNull(),
    requirements: jsonb("requirements").$type<{ goodId: string; qty: number }[]>().notNull(),
    status: text("status").$type<"OPEN" | "FULFILLED" | "REROLLED" | "REPLACED">().notNull(),
    difficulty: text("difficulty").$type<OrderDifficulty>().notNull(),
    solvable: boolean("solvable").notNull(),
    rewardCoins: integer("reward_coins").notNull(),
    rewardXp: integer("reward_xp").notNull(),
    civicStars: integer("civic_stars").notNull(),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("order_instances_open_slot")
      .on(table.cityId, table.slot)
      .where(sql`${table.status} = 'OPEN'`),
  ],
);

export const trainShipments = pgTable(
  "train_shipments",
  {
    id: uuid("id").primaryKey(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    status: text("status").$type<"LOADING" | "IN_TRANSIT" | "ARRIVED">().notNull(),
    stationId: text("station_id"),
    wagons: jsonb("wagons").$type<unknown[]>().notNull().default([]),
    completionBonusPaid: boolean("completion_bonus_paid").notNull().default(false),
    helpRequestAt: timestamp("help_request_at", { withTimezone: true }),
    departedAt: timestamp("departed_at", { withTimezone: true }),
    returnsAt: timestamp("returns_at", { withTimezone: true }),
    version: bigint("version", { mode: "number" }).notNull().default(1),
  },
  (table) => [
    uniqueIndex("train_shipments_one_active")
      .on(table.cityId)
      .where(sql`${table.status} <> 'ARRIVED'`),
  ],
);

export const franchises = pgTable(
  "franchises",
  {
    id: uuid("id").primaryKey(),
    ownerCity: uuid("owner_city")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    hostCity: uuid("host_city")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    businessDefinitionId: text("business_definition_id").notNull(),
    hostPlot: jsonb("host_plot").$type<Record<string, unknown>>().notNull().default({}),
    isTrial: boolean("is_trial").notNull().default(false),
    state: text("state").notNull(),
    splitBps: integer("split_bps").notNull().default(6000),
    streakDays: integer("streak_days").notNull().default(0),
    lastSupplyDay: date("last_supply_day"),
    stockCycles: smallint("stock_cycles").notNull().default(0),
    cycleStartedAt: timestamp("cycle_started_at", { withTimezone: true }),
    plotX: integer("plot_x"),
    plotY: integer("plot_y"),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("franchises_one_open_business")
      .on(table.ownerCity, table.businessDefinitionId)
      .where(sql`${table.state} in ('REQUESTED', 'ACCEPTED', 'ACTIVE', 'PAUSED')`),
  ],
);

export const franchiseShipments = pgTable(
  "franchise_shipments",
  {
    id: uuid("id").primaryKey(),
    franchiseId: uuid("franchise_id")
      .notNull()
      .references(() => franchises.id, { onDelete: "cascade" }),
    commandId: uuid("command_id").notNull(),
    goods: jsonb("goods").$type<unknown[]>().notNull().default([]),
    ownerAmount: integer("owner_amount").notNull(),
    hostAmount: integer("host_amount").notNull(),
    totalValue: integer("total_value").notNull(),
    streakBonusBps: integer("streak_bonus_bps").notNull().default(0),
    state: text("state").notNull(),
    suppliedAt: timestamp("supplied_at", { withTimezone: true }),
    earnCompletesAt: timestamp("earn_completes_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("franchise_shipments_command_unique").on(table.franchiseId, table.commandId),
  ],
);

export const quests = pgTable(
  "quests",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    periodKey: text("period_key").notNull().default("-"),
    track: text("track").$type<"story" | "growth" | "weekly">().notNull(),
    stepState: jsonb("step_state").$type<Record<string, number>>().notNull().default({}),
    status: text("status").notNull(),
    stepIndex: integer("step_index").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    version: bigint("version", { mode: "number" }).notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.questId, table.periodKey] })],
);

export const npcVisits = pgTable(
  "npc_visits",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    npcCityId: uuid("npc_city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }),
    actionsUsed: smallint("actions_used").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.npcCityId] })],
);

export const commandDedup = pgTable(
  "command_dedup",
  {
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commandId: text("command_id").notNull(),
    requestHash: text("request_hash").notNull(),
    statusCode: integer("status_code"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.actorId, table.commandId] })],
);

export const telemetryEvents = pgTable("telemetry_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  playerId: uuid("player_id"),
  sessionId: uuid("session_id"),
  name: text("name").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  contentVersion: integer("content_version"),
  cityLevel: integer("city_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schemaMigrations = pgTable("schema_migrations", {
  id: text("id").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});
