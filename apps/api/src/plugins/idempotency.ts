import { ensureRecoveryOrder } from "../modules/orderRecovery";
import { progressQuests } from "../modules/questProgress";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CONTENT_VERSION, levelForXp } from "@nf/shared";
import { commandSuccessSchema, type CommandSuccess, type Delta } from "@nf/shared/schemas";
import type { Database } from "../db/client";
import { cities, commandDedup, inventoryBalances, inventoryLedger, telemetryEvents } from "../db/schema";
import { ApiError } from "../errors";
import { orderedCityIds } from "../commands/orderedCityIds";
import type { LedgerWrite } from "../economy/ledger";
import { readChangedDelta, resolveStoredTimers } from "../modules/cityState";
import { presentInventory } from "../modules/present";

export type { LedgerWrite };

type CityResource = "COINS" | "XP" | "GEMS" | "CIVIC_STARS";

function isCityResource(resource: string): resource is CityResource {
  switch (resource) {
    case "COINS":
    case "XP":
    case "GEMS":
    case "CIVIC_STARS":
      return true;
    default:
      return false;
  }
}

export type CommandEffects = {
  readonly ledger: readonly LedgerWrite[];
  readonly telemetry?: { readonly name: string; readonly payload: Record<string, unknown> };
  readonly result?: unknown;
  readonly cityPatch?: { readonly population: number; readonly populationCap: number };
};

export type CommandTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type CommandContext = {
  readonly tx: CommandTx;
  readonly now: Date;
  readonly commandId: string;
  readonly versionAfter: number;
  readonly cityVersion: number;
  readonly failureDelta: Delta;
};

export type CommandOutcome = {
  readonly statusCode: number;
  readonly body: CommandSuccess;
  readonly replayed: boolean;
};

type Execute = Database["execute"];

export async function selectCitiesForUpdate(execute: Execute, cityIds: readonly string[]): Promise<string[]> {
  const ordered = orderedCityIds(cityIds);
  if (ordered.length === 0) {
    return [];
  }
  const result = await execute<{ id: string }>(sql`
    select id from cities
    where id in (${sql.join(ordered.map((id) => sql`${id}`), sql`, `)})
    order by id
    for update
  `);
  const locked = result.rows.map((row) => row.id);
  if (locked.length !== ordered.length) {
    throw new ApiError(404, "NOT_FOUND", "City not found");
  }
  for (let index = 0; index < ordered.length; index += 1) {
    if (locked[index] !== ordered[index]) {
      throw new Error("SELECT ... FOR UPDATE returned city ids out of ascending order");
    }
  }
  return locked;
}

export async function lockCityIds(db: Database, cityIds: readonly string[]): Promise<string[]> {
  return db.transaction(async (tx) => selectCitiesForUpdate(tx.execute.bind(tx), cityIds));
}

export async function runCommand(
  db: Database,
  input: {
    readonly actorId: string;
    readonly sessionId: string;
    readonly cityId: string;
    readonly cityIds: readonly string[];
    readonly commandId: string;
    readonly requestHash: string;
    readonly fromVersion: number | null;
    readonly now: Date;
    readonly cityLevel: number;
    readonly apply: (ctx: CommandContext) => Promise<CommandEffects>;
  },
): Promise<CommandOutcome> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(commandDedup)
      .values({
        actorId: input.actorId,
        commandId: input.commandId,
        requestHash: input.requestHash,
        statusCode: null,
        result: null,
      })
      .onConflictDoNothing()
      .returning({ commandId: commandDedup.commandId });

    if (inserted.length === 0) {
      const existing = await tx
        .select()
        .from(commandDedup)
        .where(and(eq(commandDedup.actorId, input.actorId), eq(commandDedup.commandId, input.commandId)))
        .for("update");
      const row = existing[0];
      if (row === undefined || row.statusCode === null || row.result === null) {
        throw new ApiError(409, "STATE_CHANGED", "Command is still in progress");
      }
      if (row.requestHash !== input.requestHash) {
        throw new ApiError(
          422,
          "IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key was already used with a different request body",
        );
      }
      return { statusCode: row.statusCode, body: commandSuccessSchema.parse(row.result), replayed: true };
    }

    const locked = await selectCitiesForUpdate(tx.execute.bind(tx), input.cityIds);
    if (!locked.includes(input.cityId)) {
      throw new ApiError(404, "NOT_FOUND", "City not found");
    }
    const owned = await tx.execute<{ id: string }>(sql`
      select id from cities
      where id = ${input.cityId} and owner_id = ${input.actorId}
      for update
    `);
    if (owned.rows.length !== 1) {
      throw new ApiError(404, "NOT_FOUND", "City not found");
    }

    const [city] = await tx.select().from(cities).where(eq(cities.id, input.cityId)).limit(1);
    if (city === undefined) {
      throw new ApiError(404, "NOT_FOUND", "City not found");
    }
    const preVersion = Number(city.version);
    const versionAfter = preVersion + 1;
    const deltaFrom = input.fromVersion !== null && input.fromVersion < preVersion ? input.fromVersion : preVersion;
    const balancesNow = await tx.select().from(inventoryBalances).where(eq(inventoryBalances.cityId, input.cityId));
    const failureDelta = await readChangedDelta(
      tx,
      city,
      deltaFrom,
      preVersion,
      presentInventory(balancesNow),
      deltaFrom < preVersion,
    );
    const ctx: CommandContext = {
      tx,
      now: input.now,
      commandId: input.commandId,
      versionAfter,
      cityVersion: preVersion,
      failureDelta,
    };

    let effects: CommandEffects;
    try {
      await resolveStoredTimers(tx, input.cityId, input.now, versionAfter);
      effects = await input.apply(ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError(error.statusCode, error.code, error.message, {
          ...(error.details === undefined ? {} : { details: error.details }),
          cityVersion: error.cityVersion ?? preVersion,
          delta: error.delta ?? failureDelta,
        });
      }
      throw error;
    }
    if (effects.telemetry !== undefined) await progressQuests(ctx, input.cityId, effects.telemetry);
    for (const entry of effects.ledger) {
      if (entry.source === "goods_collected" && entry.delta > 0) await progressQuests(ctx, input.cityId, { name: "goods_produced", payload: { goodId: entry.resource, qty: entry.delta } });
    }
    if (city.tutorialState !== null) {
      const event = effects.telemetry;
      const step = city.tutorialState.step;
      let next = step;
      if (step === "place_house" && event?.name === "building_placed" && event.payload.definitionId === "B-001") next = "collect_wheat";
      else if (step === "collect_wheat" && effects.ledger.some(e => e.resource === "GOOD_WHEAT" && e.delta > 0)) next = "supply_grocery";
      else if (step === "supply_grocery" && event?.name === "business_supplied" && event.payload.definitionId === "B-004") next = "collect_coins";
      else if (step === "collect_coins" && event?.name === "coins_collected") next = "build_bakery";
      else if (step === "build_bakery" && event?.name === "building_placed" && event.payload.definitionId === "B-007") next = "tutorial_core_complete";
      if (next !== step) {
        await tx.update(cities).set({ tutorialState: { step: next, guideNpcId: "NPC-MIA" } }).where(eq(cities.id, input.cityId));
        if (next === "tutorial_core_complete") await tx.insert(telemetryEvents).values({ playerId: input.actorId, sessionId: input.sessionId, name: "tutorial_core_complete", payload: {}, contentVersion: CONTENT_VERSION, cityLevel: city.level });
      }
    }
    const cityBalances = {
      coins: Number(city.coins),
      xp: Number(city.xp),
      gems: city.gems,
      civicStars: city.civicStars,
    };
    const priorRewards = effects.ledger.some(entry => entry.source === "level_reward")
      ? await tx.select({ resource: inventoryLedger.resource }).from(inventoryLedger).where(and(eq(inventoryLedger.cityId, input.cityId), eq(inventoryLedger.source, "level_reward")))
      : [];
    for (const entry of effects.ledger) {
      if (entry.source === "level_reward" && priorRewards.some(reward => reward.resource === entry.resource)) continue;
      if (entry.delta === 0) {
        throw new Error("inventory_ledger delta must be non-zero");
      }
      const balanceAfter = await writeLedgerEntry(tx, {
        cityId: input.cityId,
        entry,
        commandId: input.commandId,
        versionAfter,
        cityBalances,
      });
      if (isCityResource(entry.resource)) {
        applyCityResource(cityBalances, entry.resource, balanceAfter);
      }
    }

    const nextLevel = levelForXp(cityBalances.xp);
    const population = effects.cityPatch?.population ?? city.population;
    const populationCap = effects.cityPatch?.populationCap ?? city.populationCap;
    await tx
      .update(cities)
      .set({
        version: versionAfter,
        updatedAt: input.now,
        coins: cityBalances.coins,
        xp: cityBalances.xp,
        gems: cityBalances.gems,
        civicStars: cityBalances.civicStars,
        level: nextLevel,
        population,
        populationCap,
      })
      .where(eq(cities.id, input.cityId));

    await ensureRecoveryOrder(ctx, input.cityId);

    if (effects.telemetry !== undefined) {
      await tx.insert(telemetryEvents).values({
        playerId: input.actorId,
        sessionId: input.sessionId,
        name: effects.telemetry.name,
        payload: effects.telemetry.payload,
        contentVersion: CONTENT_VERSION,
        cityLevel: nextLevel,
      });
    }

    const stale = input.fromVersion !== null && input.fromVersion !== preVersion;
    const cityResourcesTouched = effects.ledger.some((entry) => isCityResource(entry.resource));
    const touched = [
      ...new Set(effects.ledger.map((entry) => entry.resource).filter((resource) => !isCityResource(resource))),
    ];
    const balances =
      stale || touched.length === 0
        ? await tx.select().from(inventoryBalances).where(eq(inventoryBalances.cityId, input.cityId))
        : await tx
            .select()
            .from(inventoryBalances)
            .where(and(eq(inventoryBalances.cityId, input.cityId), inArray(inventoryBalances.goodId, touched)));

    const body = commandSuccessSchema.parse({
      result: effects.result ?? {},
      delta: await readChangedDelta(
        tx,
        {
          ...city,
          coins: cityBalances.coins,
          xp: cityBalances.xp,
          gems: cityBalances.gems,
          civicStars: cityBalances.civicStars,
          level: nextLevel,
          population,
          populationCap,
          version: versionAfter,
        },
        deltaFrom,
        versionAfter,
        presentInventory(balances),
        stale || cityResourcesTouched || effects.cityPatch !== undefined,
      ),
      cityVersion: versionAfter,
    });

    await tx
      .update(commandDedup)
      .set({ statusCode: 200, result: body })
      .where(and(eq(commandDedup.actorId, input.actorId), eq(commandDedup.commandId, input.commandId)));

    return { statusCode: 200, body, replayed: false };
  });
}

type CityBalances = {
  coins: number;
  xp: number;
  gems: number;
  civicStars: number;
};

function readCityResource(balances: CityBalances, resource: CityResource): number {
  switch (resource) {
    case "COINS":
      return balances.coins;
    case "XP":
      return balances.xp;
    case "GEMS":
      return balances.gems;
    case "CIVIC_STARS":
      return balances.civicStars;
    default: {
      const unreachable: never = resource;
      throw new Error(`unknown city resource ${String(unreachable)}`);
    }
  }
}

function applyCityResource(balances: CityBalances, resource: CityResource, balanceAfter: number): void {
  switch (resource) {
    case "COINS":
      balances.coins = balanceAfter;
      return;
    case "XP":
      balances.xp = balanceAfter;
      return;
    case "GEMS":
      balances.gems = balanceAfter;
      return;
    case "CIVIC_STARS":
      balances.civicStars = balanceAfter;
      return;
    default: {
      const unreachable: never = resource;
      throw new Error(`unknown city resource ${String(unreachable)}`);
    }
  }
}

async function writeLedgerEntry(
  tx: CommandTx,
  input: {
    readonly cityId: string;
    readonly entry: LedgerWrite;
    readonly commandId: string;
    readonly versionAfter: number;
    readonly cityBalances: CityBalances;
  },
): Promise<number> {
  let balanceAfter: number;
  if (isCityResource(input.entry.resource)) {
    balanceAfter = readCityResource(input.cityBalances, input.entry.resource) + input.entry.delta;
  } else {
    const existing = await tx
      .select({ qty: inventoryBalances.qty })
      .from(inventoryBalances)
      .where(and(eq(inventoryBalances.cityId, input.cityId), eq(inventoryBalances.goodId, input.entry.resource)))
      .limit(1);
    balanceAfter = (existing[0]?.qty ?? 0) + input.entry.delta;
    await tx
      .insert(inventoryBalances)
      .values({
        cityId: input.cityId,
        goodId: input.entry.resource,
        qty: balanceAfter,
        version: input.versionAfter,
      })
      .onConflictDoUpdate({
        target: [inventoryBalances.cityId, inventoryBalances.goodId],
        set: { qty: balanceAfter, version: input.versionAfter },
      });
  }
  await tx.insert(inventoryLedger).values({
    cityId: input.cityId,
    resource: input.entry.resource,
    delta: input.entry.delta,
    balanceAfter,
    source: input.entry.source,
    commandId: input.commandId,
    refType: input.entry.refType ?? null,
    refId: input.entry.refId ?? null,
  });
  return balanceAfter;
}
