import { PASSIVE_CAP_SECONDS, rentCollectible, type BuildingLevel } from "@nf/shared";
import { consumeInputCycle, findPlaceable, fullInputCycles } from "./catalog";
import { commercialYield } from "./modifiers";
import { TUTORIAL_SALE_SECONDS, cloneBuilding, cloneJob, type World, type WorldBuilding, type WorldJob } from "./model";
import { transitionToward } from "./transition";

export type TimerChanges = {
  readonly buildings: readonly WorldBuilding[];
  readonly jobs: readonly WorldJob[];
};

export function resolveTimers(world: World): TimerChanges {
  const buildings = new Map(world.buildings.map((building) => [building.id, cloneBuilding(building)]));
  const jobs = new Map(world.jobs.map((job) => [job.id, cloneJob(job)]));
  const dirtyBuildings = new Set<string>();
  const dirtyJobs = new Set<string>();

  for (const building of buildings.values()) {
    if (building.removedAt !== null) {
      continue;
    }
    if (settleConstruction(building, world.now)) {
      dirtyBuildings.add(building.id);
    }
    if (settleAgriculture(building, world.now)) {
      dirtyBuildings.add(building.id);
    }
  }
  settleProduction(buildings, jobs, world.now, dirtyBuildings, dirtyJobs);
  const settledBuildings = [...buildings.values()];
  for (const building of buildings.values()) {
    if (building.removedAt !== null) {
      continue;
    }
    if (settleCommercial(building, settledBuildings, world.now)) {
      dirtyBuildings.add(building.id);
    }
  }

  return {
    buildings: [...dirtyBuildings].flatMap((id) => {
      const building = buildings.get(id);
      return building === undefined ? [] : [building];
    }),
    jobs: [...dirtyJobs].flatMap((id) => {
      const job = jobs.get(id);
      return job === undefined ? [] : [job];
    }),
  };
}

export function applyTimerChanges(world: World, changes: TimerChanges): World {
  const buildings = new Map(world.buildings.map((building) => [building.id, building]));
  for (const building of changes.buildings) {
    buildings.set(building.id, building);
  }
  const jobs = new Map(world.jobs.map((job) => [job.id, job]));
  for (const job of changes.jobs) {
    jobs.set(job.id, job);
  }
  return { ...world, buildings: [...buildings.values()], jobs: [...jobs.values()] };
}

export function passiveCycles(nowMs: number, lastCollectedMs: number, cycleSeconds: number): number {
  if (cycleSeconds <= 0) {
    return 0;
  }
  const elapsed = Math.floor((Math.floor(nowMs / 1000) - Math.floor(lastCollectedMs / 1000)) / cycleSeconds);
  const capped = Math.floor(PASSIVE_CAP_SECONDS / cycleSeconds);
  return Math.max(0, Math.min(elapsed, capped));
}

export function rentDue(building: WorldBuilding, nowMs: number): { readonly coins: number; readonly nextCollectedAt: number } {
  const placeable = findPlaceable(building.definitionId);
  if (
    placeable === null ||
    placeable.kind !== "building" ||
    placeable.definition.category !== "residential" ||
    building.removedAt !== null ||
    building.state === "UNDER_CONSTRUCTION" ||
    building.lastCollectedAt === null
  ) {
    return { coins: 0, nextCollectedAt: building.lastCollectedAt ?? nowMs };
  }
  const cycleSeconds = placeable.definition.rent.seconds;
  const cycles = passiveCycles(nowMs, building.lastCollectedAt, cycleSeconds);
  const coins = Math.floor(
    rentCollectible({
      now: Math.floor(nowMs / 1000),
      lastCollectedAt: Math.floor(building.lastCollectedAt / 1000),
      cycleSeconds,
      baseRent: placeable.definition.rent.coins,
      level: building.level,
    }),
  );
  const elapsedSeconds = Math.floor(nowMs / 1000) - Math.floor(building.lastCollectedAt / 1000);
  const nextCollectedAt =
    elapsedSeconds > PASSIVE_CAP_SECONDS ? nowMs : building.lastCollectedAt + cycles * cycleSeconds * 1000;
  return { coins, nextCollectedAt };
}

function settleConstruction(building: WorldBuilding, now: number): boolean {
  if (building.state !== "UNDER_CONSTRUCTION" || building.constructionCompletesAt === null || building.constructionCompletesAt > now) {
    return false;
  }
  const placeable = findPlaceable(building.definitionId);
  const commercial = placeable?.kind === "building" && placeable.definition.category === "commercial";
  const residential = placeable?.kind === "building" && placeable.definition.category === "residential";
  const next = commercial ? "NEEDS_SUPPLY" : "ACTIVE";
  const mutable = building as {
    state: WorldBuilding["state"];
    constructionCompletesAt: number | null;
    lastCollectedAt: number | null;
  };
  mutable.state = transitionToward(building.state, next);
  mutable.constructionCompletesAt = null;
  if (residential) {
    mutable.lastCollectedAt = now;
  }
  return true;
}

function settleAgriculture(building: WorldBuilding, now: number): boolean {
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null || placeable.kind !== "agriculture" || building.state !== "ACTIVE") {
    return false;
  }
  if (building.constructionCompletesAt === null || building.constructionCompletesAt > now || building.outputReady !== null) {
    return false;
  }
  const mutable = building as {
    state: WorldBuilding["state"];
    outputReady: WorldBuilding["outputReady"];
  };
  mutable.outputReady = { goodId: placeable.definition.outputGoodId, qty: placeable.definition.outputQty };
  mutable.state = transitionToward(building.state, "READY_TO_COLLECT");
  return true;
}

function settleProduction(
  buildings: ReadonlyMap<string, WorldBuilding>,
  jobs: ReadonlyMap<string, WorldJob>,
  now: number,
  dirtyBuildings: Set<string>,
  dirtyJobs: Set<string>,
): void {
  const byBuilding = new Map<string, WorldJob[]>();
  for (const job of jobs.values()) {
    if (job.movedToOutputAt !== null || job.cancelledAt !== null) {
      continue;
    }
    const list = byBuilding.get(job.buildingId) ?? [];
    list.push(job);
    byBuilding.set(job.buildingId, list);
  }
  for (const [buildingId, list] of byBuilding) {
    const building = buildings.get(buildingId);
    if (building === undefined || building.removedAt !== null) {
      continue;
    }
    list.sort((left, right) => left.slot - right.slot || left.completesAt - right.completesAt);
    let output = building.outputReady === null ? null : { ...building.outputReady };
    let moved = false;
    for (const job of list) {
      if (job.completesAt > now) {
        break;
      }
      if (job.outputs !== null && job.outputs.qty > 0) {
        if (output !== null && output.goodId !== job.outputs.goodId) {
          break;
        }
        output = { goodId: job.outputs.goodId, qty: (output?.qty ?? 0) + job.outputs.qty };
      }
      const jobMutable = job as { movedToOutputAt: number | null };
      jobMutable.movedToOutputAt = now;
      dirtyJobs.add(job.id);
      moved = true;
    }
    if (!moved) {
      continue;
    }
    const buildingMutable = building as {
      outputReady: WorldBuilding["outputReady"];
      state: WorldBuilding["state"];
    };
    buildingMutable.outputReady = output;
    const stillQueued = list.some((job) => job.movedToOutputAt === null && job.cancelledAt === null);
    if (!stillQueued) {
      buildingMutable.state = transitionToward(building.state, output === null ? "ACTIVE" : "READY_TO_COLLECT");
    } else if (building.state === "ACTIVE") {
      buildingMutable.state = transitionToward(building.state, "PRODUCING");
    }
    dirtyBuildings.add(building.id);
  }
}

function settleCommercial(building: WorldBuilding, buildings: readonly WorldBuilding[], now: number): boolean {
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null || placeable.kind !== "building" || placeable.definition.category !== "commercial") {
    return false;
  }
  if (building.cycleStartedAt === null || building.state === "UNDER_CONSTRUCTION") {
    return false;
  }
  const definition = placeable.definition;
  const reward = commercialYield(building, buildings);
  const windowStart = building.lastCollectedAt ?? building.cycleStartedAt;
  const capEnd = windowStart + PASSIVE_CAP_SECONDS * 1000;
  const limit = Math.min(now, capEnd);
  let cursor = building.cycleStartedAt;
  let seconds = building.stock.tutorialCycle ? TUTORIAL_SALE_SECONDS : definition.salesCycleSeconds;
  let completed = 0;
  let goods = { ...building.stock.goods };
  while (cursor + seconds * 1000 <= limit) {
    const nextGoods = consumeInputCycle(goods, definition.stockInput);
    if (nextGoods === null) {
      break;
    }
    goods = nextGoods;
    completed += 1;
    cursor += seconds * 1000;
    seconds = definition.salesCycleSeconds;
  }
  const stocked = fullInputCycles(goods, definition.stockInput) >= 1;
  const capped = now >= capEnd;
  const mutable = building as {
    state: WorldBuilding["state"];
    cycleStartedAt: number | null;
    stock: {
      goods: WorldBuilding["stock"]["goods"];
      pendingCoins: number;
      tutorialCycle: boolean;
      tutorialUsed: boolean;
      paidCoins?: number;
    };
  };
  if (completed === 0 && !(capped && building.cycleStartedAt !== null && !stocked)) {
    if (!(capped && stocked)) {
      return false;
    }
  }
  mutable.stock.goods = goods;
  mutable.stock.pendingCoins += completed * reward;
  if (completed > 0) {
    mutable.stock.tutorialCycle = false;
  }
  if (!stocked) {
    mutable.cycleStartedAt = null;
    mutable.state = transitionToward(building.state, mutable.stock.pendingCoins > 0 ? "READY_TO_COLLECT" : "NEEDS_SUPPLY");
  } else if (capped) {
    mutable.cycleStartedAt = null;
    mutable.state = transitionToward(building.state, mutable.stock.pendingCoins > 0 ? "READY_TO_COLLECT" : "ACTIVE");
  } else {
    mutable.cycleStartedAt = cursor;
    if (building.state === "NEEDS_SUPPLY" || building.state === "READY_TO_COLLECT") {
      mutable.state = transitionToward(building.state, "ACTIVE");
    }
  }
  return true;
}

export function buildingLevel(value: number): BuildingLevel {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(`building level ${value} is outside 1..3`);
}
