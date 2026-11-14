import {
  QUESTS,
  UNDO_WINDOW_SECONDS,
  apiErrorForPlaceReason,
  commercialInputCapacity,
  recipeById,
  type ErrorCode,
  type GoodId,
  type QuarterTurns,
  type RecipeId,
} from "@nf/shared";
import {
  canPlace,
  collectReadyOutput,
  effectiveBuildSeconds,
  effectivePlacementCost,
  removalBlock,
  removalRefund,
  warehouseCapacity,
  type PlacementCity,
} from "@nf/shared/rules";
import { catalogCost, findPlaceable, footprintCells, fullInputCycles, goodsUnitCount, isGoodId, type Placeable } from "./catalog";
import { levelRewardEntries, placementXp, type LedgerWrite } from "./ledger";
import { commercialYield } from "./modifiers";
import {
  TUTORIAL_SALE_SECONDS,
  activeBuildings,
  cloneBuilding,
  projectPopulation,
  type World,
  type WorldBuilding,
  type WorldJob,
} from "./model";
import { rentDue } from "./timers";
import { transitionToward } from "./transition";

export type CityPatch = {
  readonly population: number;
  readonly populationCap: number;
};

export type Plan =
  | {
      readonly ok: true;
      readonly buildings: readonly WorldBuilding[];
      readonly jobs: readonly WorldJob[];
      readonly cellReplaces: readonly { readonly buildingId: string; readonly cells: readonly { readonly x: number; readonly y: number }[] }[];
      readonly ledger: readonly LedgerWrite[];
      readonly result: unknown;
      readonly telemetry?: { readonly name: string; readonly payload: Record<string, unknown> };
      readonly cityPatch?: CityPatch;
    }
  | { readonly ok: false; readonly status: number; readonly code: ErrorCode; readonly message: string };

export type PlanIds = {
  readonly instanceId: string;
  readonly jobId: string;
  readonly undoToken: string;
};

const PRODUCTION_SLOTS = 2;
const PRODUCTION_SLOTS_WITH_QUEUE = 3;

export function productionSlotCount(level: number): number {
  return level >= 5 ? PRODUCTION_SLOTS_WITH_QUEUE : PRODUCTION_SLOTS;
}

export function planPlace(
  world: World,
  command: { readonly definitionId: string; readonly x: number; readonly y: number; readonly rotation: QuarterTurns },
  ids: PlanIds,
): Plan {
  const placeable = findPlaceable(command.definitionId);
  if (placeable === null) {
    return failure(400, "VALIDATION", "Unknown building");
  }
  const owned = activeBuildings(world.buildings).filter((building) => building.definitionId === command.definitionId).length;
  const charged = chargedCoins(placeable, owned);
  const seconds = buildSeconds(placeable, owned);
  const flower = world.quests.find(q => q.questId === "quest_flower_street");
  const flowerDefinition = QUESTS.find(q => q.id === "quest_flower_street");
  const benchUnlocked = command.definitionId === "D-003" && flower?.status === "ACTIVE" && flower.stepIndex === 6
    && (flower.stepState["6"] ?? 0) === 0
    && flowerDefinition !== undefined
    && flowerDefinition.steps.slice(0, 6).every((step, index) => (flower.stepState[String(index)] ?? 0) >= step.amount)
    && !world.buildings.some(building => building.definitionId === "D-003");
  const verdict = canPlace(placementCity(world), benchUnlocked ? { ...placeable.placeable, unlockLevel: 1 } : placeable.placeable, command.x, command.y, command.rotation);
  if (!verdict.ok) {
    const reason = verdict.reasons[0];
    if (reason === undefined) {
      return failure(422, "VALIDATION", "Building cannot be placed");
    }
    const error = apiErrorForPlaceReason(reason);
    return failure(error.status, error.code, placeMessage(reason));
  }
  if (charged > world.city.coins) {
    return failure(409, "INSUFFICIENT_COINS", "Not enough coins");
  }
  const timing = initialTiming(placeable, seconds, world.now);
  const building: WorldBuilding = {
    id: ids.instanceId,
    definitionId: command.definitionId,
    level: 1,
    x: command.x,
    y: command.y,
    rotation: command.rotation,
    state: timing.state,
    constructionCompletesAt: timing.constructionCompletesAt,
    cycleStartedAt: timing.cycleStartedAt,
    lastCollectedAt: timing.lastCollectedAt,
    stock: { goods: {}, pendingCoins: 0, tutorialCycle: false, tutorialUsed: false, paidCoins: charged },
    outputReady: null,
    removedAt: null,
    undoExpiresAt: null,
    createdAt: world.now,
  };
  const xp = placementXp(charged);
  const ledger: LedgerWrite[] = [];
  if (charged > 0) {
    ledger.push({ resource: "COINS", delta: -charged, source: "building_placed", refType: "building", refId: building.id });
  }
  ledger.push({ resource: "XP", delta: xp, source: "building_placed", refType: "building", refId: building.id });
  ledger.push(...levelRewardEntries(world.city.xp, world.city.xp + xp));
  const population = projectPopulation([...world.buildings, building]);
  return {
    ok: true,
    buildings: [building],
    jobs: [],
    cellReplaces: [{ buildingId: building.id, cells: footprintCells(building.definitionId, building.x, building.y, building.rotation) }],
    ledger,
    result: { instanceId: building.id, state: building.state, cost: charged, xp, ...population },
    telemetry: {
      name: placeable.kind === "decoration" ? "decoration_placed" : "building_placed",
      payload: { definitionId: building.definitionId, instanceId: building.id, x: building.x, y: building.y },
    },
    cityPatch: population,
  };
}

export function planMove(
  world: World,
  command: { readonly instanceId: string; readonly x: number; readonly y: number; readonly rotation: QuarterTurns },
  ids: PlanIds,
): Plan {
  const building = activeBuildings(world.buildings).find((entry) => entry.id === command.instanceId);
  if (building === undefined) {
    return failure(404, "NOT_FOUND", "Building not found");
  }
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null) {
    return failure(400, "VALIDATION", "Unknown building");
  }
  const population = residentialPopulation(placeable);
  const verdict = canPlace(
    placementCity(world, {
      coins: Math.max(world.city.coins, placeable.placeable.costCoins),
      population: Math.max(0, world.city.population - population),
    }),
    placeable.placeable,
    command.x,
    command.y,
    command.rotation,
    building.id,
  );
  if (!verdict.ok) {
    const reason = verdict.reasons[0];
    if (reason === undefined) {
      return failure(422, "VALIDATION", "Building cannot be moved");
    }
    const error = apiErrorForPlaceReason(reason);
    return failure(error.status, error.code, placeMessage(reason));
  }
  const next = cloneBuilding(building);
  const moved: WorldBuilding = { ...next, x: command.x, y: command.y, rotation: command.rotation };
  return {
    ok: true,
    buildings: [moved],
    jobs: [],
    cellReplaces: [{ buildingId: building.id, cells: footprintCells(building.definitionId, command.x, command.y, command.rotation) }],
    ledger: [],
    result: {
      instanceId: building.id,
      x: command.x,
      y: command.y,
      rotation: command.rotation,
      undoToken: ids.undoToken,
      previous: { x: building.x, y: building.y, rotation: building.rotation },
    },
    telemetry: { name: "building_moved", payload: { instanceId: building.id, x: command.x, y: command.y } },
  };
}

export function planRemove(world: World, command: { readonly instanceId: string; readonly undo?: true }): Plan {
  const building = world.buildings.find((entry) => entry.id === command.instanceId);
  if (building === undefined) {
    return failure(404, "NOT_FOUND", "Building not found");
  }
  if (command.undo === true) {
    return planUndoRemove(world, building);
  }
  if (building.removedAt !== null) {
    return failure(409, "STATE_CHANGED", "Building is already removed");
  }
  const block = removalBlock({
    definitionId: building.definitionId,
    placedDefinitionIds: activeBuildings(world.buildings).map((entry) => entry.definitionId),
  });
  if (block !== null) {
    return failure(422, block, block === "TOWN_HALL" ? "Town Hall cannot be removed" : "The last Wheat plot cannot be removed");
  }
  const placeable = findPlaceable(building.definitionId);
  const basis = building.stock.paidCoins ?? (placeable === null ? 0 : catalogCost(placeable));
  const refund = removalRefund(basis);
  const removed: WorldBuilding = {
    ...cloneBuilding(building),
    removedAt: world.now,
    undoExpiresAt: world.now + UNDO_WINDOW_SECONDS * 1000,
  };
  const ledger: LedgerWrite[] = [];
  if (refund > 0) {
    ledger.push({ resource: "COINS", delta: refund, source: "building_removed", refType: "building", refId: building.id });
  }
  const population = projectPopulation(world.buildings.map((entry) => (entry.id === building.id ? removed : entry)));
  return {
    ok: true,
    buildings: [removed],
    jobs: [],
    cellReplaces: [{ buildingId: building.id, cells: [] }],
    ledger,
    result: { instanceId: building.id, refund, undoExpiresAt: new Date(removed.undoExpiresAt ?? world.now).toISOString() },
    telemetry: { name: "building_removed", payload: { instanceId: building.id, definitionId: building.definitionId, refund } },
    cityPatch: population,
  };
}

export function planStartProduction(world: World, command: { readonly instanceId: string; readonly recipeId: RecipeId }, ids: PlanIds): Plan {
  const building = activeBuildings(world.buildings).find((entry) => entry.id === command.instanceId);
  if (building === undefined) {
    return failure(404, "NOT_FOUND", "Building not found");
  }
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null || placeable.kind !== "building" || placeable.definition.category !== "production") {
    return failure(400, "VALIDATION", "Building is not a production building");
  }
  const recipe = recipeById(command.recipeId);
  if (recipe.buildingId !== building.definitionId) {
    return failure(400, "VALIDATION", "Recipe does not belong to this building");
  }
  if (world.city.level < recipe.unlockLevel) {
    return failure(422, "LOCKED_BY_LEVEL", "Recipe is locked");
  }
  if (building.state !== "ACTIVE" && building.state !== "PRODUCING") {
    return failure(409, "STATE_CHANGED", "Building is not ready to produce");
  }
  const active = world.jobs.filter(
    (job) => job.buildingId === building.id && job.movedToOutputAt === null && job.cancelledAt === null,
  );
  if (active.length >= productionSlotCount(world.city.level)) {
    return failure(409, "STATE_CHANGED", "Production queue is full");
  }
  const balances = { ...world.balances };
  for (const input of recipe.inputs) {
    if ((balances[input.goodId] ?? 0) < input.qty) {
      return failure(409, "INSUFFICIENT_GOODS", "Not enough goods");
    }
  }
  const ledger: LedgerWrite[] = recipe.inputs.map((input) => ({
    resource: input.goodId,
    delta: -input.qty,
    source: "production_started",
    refType: "building",
    refId: building.id,
  }));
  const previousComplete = active.reduce((max, job) => Math.max(max, job.completesAt), 0);
  const startedAt = Math.max(world.now, previousComplete);
  const used = new Set(active.map((job) => job.slot));
  let slot = 0;
  while (used.has(slot)) {
    slot += 1;
  }
  const output = recipe.outputs[0];
  const job: WorldJob = {
    id: ids.jobId,
    buildingId: building.id,
    slot,
    recipeId: recipe.id,
    inputs: recipe.inputs.map((input) => ({ goodId: input.goodId, qty: input.qty })),
    outputs: output === undefined ? null : { goodId: output.goodId, qty: output.qty },
    startedAt,
    completesAt: startedAt + recipe.seconds * 1000,
    movedToOutputAt: null,
    cancelledAt: null,
  };
  const next = cloneBuilding(building);
  const updated: WorldBuilding =
    building.state === "ACTIVE" ? { ...next, state: transitionToward(building.state, "PRODUCING") } : next;
  return {
    ok: true,
    buildings: updated === next && building.state === "PRODUCING" ? [] : [updated],
    jobs: [job],
    cellReplaces: [],
    ledger,
    result: {
      jobId: job.id,
      slot: job.slot,
      startedAt: new Date(job.startedAt).toISOString(),
      completesAt: new Date(job.completesAt).toISOString(),
    },
    telemetry: { name: "production_started", payload: { instanceId: building.id, recipeId: recipe.id, jobId: job.id } },
  };
}

export function planCancelProduction(world: World, command: { readonly instanceId: string; readonly jobId: string }): Plan {
  const building = activeBuildings(world.buildings).find((entry) => entry.id === command.instanceId);
  if (building === undefined) {
    return failure(404, "NOT_FOUND", "Building not found");
  }
  const job = world.jobs.find((entry) => entry.id === command.jobId && entry.buildingId === building.id);
  if (job === undefined || job.cancelledAt !== null || job.movedToOutputAt !== null) {
    return failure(409, "STATE_CHANGED", "Production job cannot be cancelled");
  }
  const cancelled: WorldJob = { ...job, cancelledAt: world.now };
  const shifted = shiftQueue(
    world.jobs.filter((entry) => entry.buildingId === building.id),
    job.id,
    world.now,
  );
  const ledger: LedgerWrite[] = job.inputs.map((input) => ({
    resource: input.goodId,
    delta: input.qty,
    source: "production_cancelled",
    refType: "building",
    refId: building.id,
  }));
  const remaining = shifted.filter((entry) => entry.movedToOutputAt === null && entry.cancelledAt === null);
  const next = cloneBuilding(building);
  let updated = next;
  if (remaining.length === 0 && (building.state === "PRODUCING" || building.state === "READY_TO_COLLECT")) {
    updated = {
      ...next,
      state: transitionToward(building.state, building.outputReady === null ? "ACTIVE" : "READY_TO_COLLECT"),
    };
  }
  return {
    ok: true,
    buildings: updated.state === building.state && updated.outputReady === building.outputReady ? [] : [updated],
    jobs: [cancelled, ...shifted],
    cellReplaces: [],
    ledger,
    result: { jobId: job.id, refunded: job.inputs },
    telemetry: { name: "production_cancelled", payload: { instanceId: building.id, jobId: job.id } },
  };
}

export function shiftQueue(jobs: readonly WorldJob[], cancelledId: string, now: number): WorldJob[] {
  const remaining = jobs
    .filter((job) => job.id !== cancelledId && job.movedToOutputAt === null && job.cancelledAt === null)
    .sort((left, right) => left.startedAt - right.startedAt || left.slot - right.slot);
  let cursor = now;
  const next: WorldJob[] = [];
  for (const job of remaining) {
    const duration = Math.max(0, job.completesAt - job.startedAt);
    const running = job.startedAt <= now && job.completesAt > now;
    const waitingOnOutput = job.completesAt <= now;
    if (running || waitingOnOutput) {
      cursor = Math.max(cursor, job.completesAt);
      next.push(job);
      continue;
    }
    const startedAt = cursor;
    const completesAt = startedAt + duration;
    cursor = completesAt;
    next.push({ ...job, startedAt, completesAt });
  }
  return next.map((job, index) => ({ ...job, slot: index }));
}

export function planSupply(world: World, command: { readonly instanceId: string }): Plan {
  const building = activeBuildings(world.buildings).find((entry) => entry.id === command.instanceId);
  if (building === undefined) {
    return failure(404, "NOT_FOUND", "Building not found");
  }
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null || placeable.kind !== "building" || placeable.definition.category !== "commercial") {
    return failure(400, "VALIDATION", "Building is not a business");
  }
  if (building.state === "UNDER_CONSTRUCTION" || building.state === "UPGRADING" || building.state === "RELOCATING") {
    return failure(409, "STATE_CHANGED", "Business is not ready for supply");
  }
  const definition = placeable.definition;
  const next = cloneBuilding(building);
  const goods = { ...next.stock.goods };
  const cap = commercialInputCapacity(definition);
  let units = goodsUnitCount(goods);
  const supplied: Partial<Record<GoodId, number>> = {};
  const ledger: LedgerWrite[] = [];
  const balances = { ...world.balances };
  for (const line of definition.stockInput) {
    const target = line.qty * definition.stockedCycles;
    const have = goods[line.goodId] ?? 0;
    const take = Math.min(Math.max(0, target - have), balances[line.goodId] ?? 0, Math.max(0, cap - units));
    if (take <= 0) {
      continue;
    }
    goods[line.goodId] = have + take;
    balances[line.goodId] = (balances[line.goodId] ?? 0) - take;
    supplied[line.goodId] = take;
    units += take;
    ledger.push({
      resource: line.goodId,
      delta: -take,
      source: "business_supplied",
      refType: "building",
      refId: building.id,
    });
  }
  let tutorialCycle = next.stock.tutorialCycle;
  let tutorialUsed = next.stock.tutorialUsed;
  let cycleStartedAt = next.cycleStartedAt;
  let state = next.state;
  if (cycleStartedAt === null && fullInputCycles(goods, definition.stockInput) >= 1) {
    const accelerate = definition.id === "B-004" && world.city.tutorialState !== null && !tutorialUsed;
    cycleStartedAt = world.now;
    tutorialCycle = accelerate;
    tutorialUsed = tutorialUsed || accelerate;
    state = transitionToward(state, "ACTIVE");
  }
  const updated: WorldBuilding = {
    ...next,
    state,
    cycleStartedAt,
    stock: { ...next.stock, goods, tutorialCycle, tutorialUsed },
  };
  const cycles = fullInputCycles(goods, definition.stockInput);
  const projectedCoins = cycles * commercialYield(updated, world.buildings.map((entry) => (entry.id === updated.id ? updated : entry)));
  return {
    ok: true,
    buildings: [updated],
    jobs: [],
    cellReplaces: [],
    ledger,
    result: {
      instanceId: building.id,
      supplied,
      projectedCoins,
      cycleSeconds: tutorialCycle ? TUTORIAL_SALE_SECONDS : definition.salesCycleSeconds,
      state: updated.state,
    },
    telemetry: { name: "business_supplied", payload: { instanceId: building.id, definitionId: building.definitionId, projectedCoins } },
  };
}

export type CollectResult = {
  readonly coins: number;
  readonly xp: number;
  readonly goods: Partial<Record<GoodId, number>>;
  readonly collected: number;
  readonly remaining: number;
  readonly warehouseFull: boolean;
};

export function planCollect(world: World, command: { readonly instanceId?: string }): Plan {
  const targets = activeBuildings(world.buildings).filter((building) => command.instanceId === undefined || building.id === command.instanceId);
  if (command.instanceId !== undefined && targets.length === 0) {
    return failure(404, "NOT_FOUND", "Building not found");
  }
  const questGoods = questGoodIds(world);
  const stacks = targets
    .flatMap((building) => {
      if (building.outputReady === null) {
        return [];
      }
      return [
        {
          building,
          goodId: building.outputReady.goodId,
          qty: building.outputReady.qty,
          readyAt: building.constructionCompletesAt ?? building.createdAt,
          quest: questGoods.has(building.outputReady.goodId),
        },
      ];
    })
    .sort((left, right) => {
      if (world.city.collectPriority === "QUEST_FIRST" && left.quest !== right.quest) {
        return left.quest ? -1 : 1;
      }
      return left.readyAt - right.readyAt || (left.building.id < right.building.id ? -1 : 1);
    });
  const cap = world.city.warehouseCap > 0 ? world.city.warehouseCap : warehouseCapacity(0);
  let used = goodsUnitCount(balancesAsGoods(world.balances));
  const goods: Partial<Record<GoodId, number>> = {};
  const taken = new Map<string, number>();
  let collected = 0;
  let remaining = 0;
  let warehouseFull = false;
  for (const stack of stacks) {
    const decision = collectReadyOutput({ used, cap, readyUnits: stack.qty });
    if (decision.collected > 0) {
      goods[stack.goodId] = (goods[stack.goodId] ?? 0) + decision.collected;
      taken.set(stack.building.id, decision.collected);
      used += decision.collected;
      collected += decision.collected;
    }
    remaining += decision.remaining;
    if (decision.waiting || decision.blocked) {
      warehouseFull = true;
    }
  }
  const ledger: LedgerWrite[] = [];
  let coins = 0;
  const writes: WorldBuilding[] = [];
  for (const building of targets) {
    const next = cloneBuilding(building);
    let changed = false;
    const rent = rentDue(next, world.now);
    if (rent.coins > 0) {
      coins += rent.coins;
      ledger.push({ resource: "COINS", delta: rent.coins, source: "rent_collected", refType: "building", refId: building.id });
      const rented = next as { lastCollectedAt: number | null };
      rented.lastCollectedAt = rent.nextCollectedAt;
      changed = true;
    }
    if (next.stock.pendingCoins > 0) {
      coins += next.stock.pendingCoins;
      ledger.push({
        resource: "COINS",
        delta: next.stock.pendingCoins,
        source: "sales_collected",
        refType: "building",
        refId: building.id,
      });
      const stock = next.stock as { pendingCoins: number };
      stock.pendingCoins = 0;
      const commercial = next as { lastCollectedAt: number | null; cycleStartedAt: number | null; state: WorldBuilding["state"] };
      commercial.lastCollectedAt = world.now;
      changed = true;
      const placeable = findPlaceable(next.definitionId);
      if (placeable?.kind === "building" && placeable.definition.category === "commercial") {
        if (next.cycleStartedAt === null && fullInputCycles(next.stock.goods, placeable.definition.stockInput) >= 1) {
          commercial.cycleStartedAt = world.now;
          commercial.state = transitionToward(next.state, "ACTIVE");
        } else if (next.cycleStartedAt === null && fullInputCycles(next.stock.goods, placeable.definition.stockInput) < 1) {
          commercial.state = transitionToward(next.state, "NEEDS_SUPPLY");
        }
      }
    }
    const got = taken.get(building.id) ?? 0;
    if (next.outputReady !== null && got > 0) {
      const goodId = next.outputReady.goodId;
      const left = next.outputReady.qty - got;
      const output = next as { outputReady: WorldBuilding["outputReady"]; state: WorldBuilding["state"]; cycleStartedAt: number | null; constructionCompletesAt: number | null };
      output.outputReady = left > 0 ? { goodId, qty: left } : null;
      ledger.push({
        resource: goodId,
        delta: got,
        source: "goods_collected",
        refType: "building",
        refId: building.id,
      });
      changed = true;
      if (left <= 0) {
        const placeable = findPlaceable(next.definitionId);
        if (placeable?.kind === "agriculture") {
          output.state = transitionToward(next.state, "ACTIVE");
          output.cycleStartedAt = world.now;
          output.constructionCompletesAt = world.now + placeable.definition.cycleSeconds * 1000;
        } else if (placeable?.kind === "building" && placeable.definition.category === "production") {
          const queued = world.jobs.some(
            (job) => job.buildingId === building.id && job.movedToOutputAt === null && job.cancelledAt === null,
          );
          output.state = transitionToward(next.state, queued ? "PRODUCING" : "ACTIVE");
        }
      }
    }
    if (changed) {
      writes.push(next);
    }
  }
  const result: CollectResult = { coins, xp: 0, goods, collected, remaining, warehouseFull };
  const name = coins > 0 ? "coins_collected" : "goods_collected";
  return {
    ok: true,
    buildings: writes,
    jobs: [],
    cellReplaces: [],
    ledger,
    result,
    telemetry: collected > 0 || coins > 0 ? { name, payload: { coins, collected, remaining, warehouseFull } } : undefined,
  };
}

function planUndoRemove(world: World, building: WorldBuilding): Plan {
  if (building.removedAt === null || building.undoExpiresAt === null) {
    return failure(409, "STATE_CHANGED", "Building is not waiting for undo");
  }
  if (world.now > building.undoExpiresAt) {
    return failure(409, "STATE_CHANGED", "Undo window has expired");
  }
  const cells = footprintCells(building.definitionId, building.x, building.y, building.rotation);
  const occupied = new Set(
    world.cells.flatMap((cell) => (cell.occupantId === undefined ? [] : [`${cell.x},${cell.y}`])),
  );
  if (cells.some((cell) => occupied.has(`${cell.x},${cell.y}`))) {
    return failure(409, "CELL_OCCUPIED", "Cell is occupied");
  }
  const placeable = findPlaceable(building.definitionId);
  const basis = building.stock.paidCoins ?? (placeable === null ? 0 : catalogCost(placeable));
  const refund = removalRefund(basis);
  if (refund > world.city.coins) {
    return failure(409, "INSUFFICIENT_COINS", "Not enough coins");
  }
  const restored: WorldBuilding = { ...cloneBuilding(building), removedAt: null, undoExpiresAt: null };
  const ledger: LedgerWrite[] = [];
  if (refund > 0) {
    ledger.push({ resource: "COINS", delta: -refund, source: "building_remove_undo", refType: "building", refId: building.id });
  }
  const population = projectPopulation(world.buildings.map((entry) => (entry.id === building.id ? restored : entry)));
  return {
    ok: true,
    buildings: [restored],
    jobs: [],
    cellReplaces: [{ buildingId: building.id, cells }],
    ledger,
    result: { instanceId: building.id, restored: true, refundReversed: refund },
    telemetry: { name: "building_restored", payload: { instanceId: building.id } },
    cityPatch: population,
  };
}

function questGoodIds(world: World): Set<string> {
  const ids = new Set<string>();
  for (const quest of world.quests) {
    if (quest.status !== "ACTIVE") {
      continue;
    }
    const definition = QUESTS.find((entry) => entry.id === quest.questId);
    if (definition === undefined) {
      continue;
    }
    definition.steps.forEach((step, index) => {
      const progress = quest.stepState[String(index)] ?? 0;
      if (progress >= step.amount) {
        return;
      }
      const goodId = step.filter.good_id;
      if (typeof goodId === "string") {
        ids.add(goodId);
      }
    });
  }
  return ids;
}

function balancesAsGoods(balances: Readonly<Record<string, number>>): Partial<Record<GoodId, number>> {
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [goodId, qty] of Object.entries(balances)) {
    if (isGoodId(goodId) && qty > 0) {
      goods[goodId] = qty;
    }
  }
  return goods;
}

function chargedCoins(placeable: Placeable, owned: number): number {
  if (placeable.kind === "building") {
    return effectivePlacementCost(placeable.definition.cost.coins, placeable.definition.firstFree, owned);
  }
  return placeable.placeable.costCoins;
}

function buildSeconds(placeable: Placeable, owned: number): number {
  switch (placeable.kind) {
    case "building":
      return effectiveBuildSeconds(placeable.definition.buildSeconds, placeable.definition.firstInstant, owned);
    case "agriculture":
    case "decoration":
    case "road":
      return 0;
    default: {
      const unreachable: never = placeable;
      throw new Error(`unknown placeable ${String(unreachable)}`);
    }
  }
}

function initialTiming(
  placeable: Placeable,
  seconds: number,
  now: number,
): {
  readonly state: WorldBuilding["state"];
  readonly constructionCompletesAt: number | null;
  readonly cycleStartedAt: number | null;
  readonly lastCollectedAt: number | null;
} {
  if (seconds > 0) {
    return {
      state: "UNDER_CONSTRUCTION",
      constructionCompletesAt: now + seconds * 1000,
      cycleStartedAt: null,
      lastCollectedAt: null,
    };
  }
  switch (placeable.kind) {
    case "agriculture":
      return {
        state: "ACTIVE",
        constructionCompletesAt: now + placeable.definition.cycleSeconds * 1000,
        cycleStartedAt: now,
        lastCollectedAt: null,
      };
    case "building":
      if (placeable.definition.category === "commercial") {
        return { state: "NEEDS_SUPPLY", constructionCompletesAt: null, cycleStartedAt: null, lastCollectedAt: null };
      }
      if (placeable.definition.category === "residential") {
        return { state: "ACTIVE", constructionCompletesAt: null, cycleStartedAt: null, lastCollectedAt: now };
      }
      return { state: "ACTIVE", constructionCompletesAt: null, cycleStartedAt: null, lastCollectedAt: null };
    case "decoration":
    case "road":
      return { state: "ACTIVE", constructionCompletesAt: null, cycleStartedAt: null, lastCollectedAt: null };
    default: {
      const unreachable: never = placeable;
      throw new Error(`unknown placeable ${String(unreachable)}`);
    }
  }
}

function residentialPopulation(placeable: Placeable): number {
  if (placeable.kind === "building" && placeable.definition.category === "residential") {
    return placeable.definition.population;
  }
  return 0;
}

function placementCity(
  world: World,
  overrides?: { readonly coins?: number; readonly population?: number },
): PlacementCity {
  const ownedCounts: Record<string, number> = {};
  const roads: { x: number; y: number; id: string }[] = [];
  for (const building of activeBuildings(world.buildings)) {
    ownedCounts[building.definitionId] = (ownedCounts[building.definitionId] ?? 0) + 1;
    if (building.definitionId === "R-001") {
      for (const cell of footprintCells(building.definitionId, building.x, building.y, building.rotation)) {
        roads.push({ ...cell, id: building.id });
      }
    }
  }
  return {
    width: world.city.width,
    height: world.city.height,
    level: world.city.level,
    coins: overrides?.coins ?? world.city.coins,
    population: overrides?.population ?? world.city.population,
    populationCap: world.city.populationCap,
    unlockedChunks: world.city.unlockedChunks,
    cells: world.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      terrain: cell.terrain,
      ...(cell.occupantId === undefined ? {} : { occupantId: cell.occupantId }),
    })),
    roads,
    ownedCounts,
  };
}

function placeMessage(reason: string): string {
  switch (reason) {
    case "OCCUPIED":
      return "Cell is occupied";
    case "INSUFFICIENT_COINS":
      return "Not enough coins";
    case "POP_CAP":
      return "Population cap reached";
    case "OUT_OF_BOUNDS":
      return "Placement is out of bounds";
    case "CHUNK_LOCKED":
      return "That land is still locked";
    case "BAD_TERRAIN":
      return "Terrain cannot hold a building";
    case "LOCKED_BY_LEVEL":
      return "Building is locked";
    default:
      return "Building cannot be placed";
  }
}

function failure(status: number, code: ErrorCode, message: string): Plan {
  return { ok: false, status, code, message };
}
