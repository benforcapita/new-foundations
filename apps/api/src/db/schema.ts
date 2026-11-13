import { sql } from "drizzle-orm";
import type { OrderDifficulty } from "@nf/shared";
import {
  bigserial,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cities = pgTable(
  "cities",
  {
    id: text("id").primaryKey(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    coins: integer("coins").notNull().default(0),
    gems: integer("gems").notNull().default(0),
    civicStars: integer("civic_stars").notNull().default(0),
    version: integer("version").notNull().default(0),
    contentVersion: integer("content_version").notNull(),
    population: integer("population").notNull().default(0),
    populationCap: integer("population_cap").notNull().default(0),
    warehouseTier: integer("warehouse_tier").notNull().default(0),
    warehouseCap: integer("warehouse_cap").notNull().default(40),
    isNpc: boolean("is_npc").notNull().default(false),
    catalogId: text("catalog_id"),
    tutorialState: jsonb("tutorial_state").$type<{ step: string; guideNpcId: string } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    terrainId: text("terrain_id").notNull(),
    ownerClaimed: boolean("owner_claimed").notNull().default(true),
    cellRole: text("cell_role").$type<"terrain" | "franchise_plot">().notNull().default("terrain"),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.x, table.y] })],
);

export const buildingInstances = pgTable("building_instances", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  definitionId: text("definition_id").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  rotation: integer("rotation").notNull().default(0),
  state: text("state").notNull(),
  level: integer("level").notNull().default(1),
  version: integer("version").notNull().default(0),
  pendingOutput: jsonb("pending_output").$type<{ goodId: string; qty: number } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const buildingCells = pgTable(
  "building_cells",
  {
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    buildingId: text("building_id")
      .notNull()
      .references(() => buildingInstances.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.x, table.y] })],
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    goodId: text("good_id").notNull(),
    qty: integer("qty").notNull(),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.goodId] })],
);

export const inventoryLedger = pgTable("inventory_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "restrict" }),
  goodId: text("good_id").notNull(),
  delta: integer("delta").notNull(),
  source: text("source").notNull(),
  commandId: text("command_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productionJobs = pgTable(
  "production_jobs",
  {
    id: text("id").primaryKey(),
    buildingId: text("building_id")
      .notNull()
      .references(() => buildingInstances.id, { onDelete: "cascade" }),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    recipeId: text("recipe_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completesAt: timestamp("completes_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    movedToOutputAt: timestamp("moved_to_output_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
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
    id: text("id").primaryKey(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    templateId: text("template_id").notNull(),
    requirements: jsonb("requirements").$type<{ goodId: string; qty: number }[]>().notNull(),
    status: text("status").$type<"OPEN" | "FULFILLED" | "REROLLED" | "REPLACED">().notNull(),
    difficulty: text("difficulty").$type<OrderDifficulty>().notNull(),
    solvable: boolean("solvable").notNull(),
    rewardCoins: integer("reward_coins").notNull(),
    rewardXp: integer("reward_xp").notNull(),
    civicStars: integer("civic_stars").notNull(),
    version: integer("version").notNull().default(0),
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
    id: text("id").primaryKey(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    status: text("status").$type<"LOADING" | "IN_TRANSIT" | "ARRIVED">().notNull(),
    stationId: text("station_id"),
    wagons: jsonb("wagons").$type<unknown[]>().notNull().default([]),
    departedAt: timestamp("departed_at", { withTimezone: true }),
    returnsAt: timestamp("returns_at", { withTimezone: true }),
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
    id: text("id").primaryKey(),
    ownerCity: text("owner_city")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    hostCity: text("host_city")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    businessDefinitionId: text("business_definition_id").notNull(),
    state: text("state").notNull(),
    splitBps: integer("split_bps").notNull(),
    streakDays: integer("streak_days").notNull().default(0),
    version: integer("version").notNull().default(0),
    plotX: integer("plot_x"),
    plotY: integer("plot_y"),
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
    id: text("id").primaryKey(),
    franchiseId: text("franchise_id")
      .notNull()
      .references(() => franchises.id, { onDelete: "cascade" }),
    goods: jsonb("goods").$type<unknown[]>().notNull().default([]),
    ownerAmount: integer("owner_amount").notNull(),
    hostAmount: integer("host_amount").notNull(),
    totalValue: integer("total_value").notNull(),
    state: text("state").notNull(),
  },
  (table) => [
    check("franchise_shipments_split", sql`${table.ownerAmount} + ${table.hostAmount} = ${table.totalValue}`),
  ],
);

export const quests = pgTable(
  "quests",
  {
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    stepState: jsonb("step_state").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull(),
    stepIndex: integer("step_index").notNull().default(0),
    version: integer("version").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.cityId, table.questId] })],
);

export const npcVisits = pgTable("npc_visits", {
  id: text("id").primaryKey(),
  visitorCityId: text("visitor_city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  hostCityId: text("host_city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
});

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
