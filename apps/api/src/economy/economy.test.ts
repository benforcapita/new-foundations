import { expect, test } from "vitest";
import { PASSIVE_CAP_SECONDS, businessReward } from "@nf/shared";
import { applyTimerChanges, resolveTimers } from "./timers";
import {
  planCancelProduction,
  planCollect,
  planMove,
  planPlace,
  planRemove,
  planStartProduction,
  planSupply,
  productionSlotCount,
  shiftQueue,
} from "./plan";
import { wantsFullSnapshot } from "./snapshotMode";
import type { World, WorldBuilding, WorldCell, WorldJob } from "./model";

const NOW = Date.parse("2026-06-01T00:00:00.000Z");
const IDS = { instanceId: "11111111-1111-4111-8111-111111111111", jobId: "22222222-2222-4222-8222-222222222222", undoToken: "undo-1" };

test("the first cottage is free, instant, and adds eight residents once", () => {
  const placed = planPlace(grassWorld(), { definitionId: "B-001", x: 12, y: 12, rotation: 0 }, IDS);
  expect(placed.ok).toBe(true);
  if (!placed.ok) {
    return;
  }
  expect(placed.result).toMatchObject({ state: "ACTIVE", cost: 0, xp: 1, population: 8, populationCap: 50 });
  expect(placed.ledger).toEqual([
    expect.objectContaining({ resource: "XP", delta: 1, source: "building_placed" }),
  ]);
  expect(placed.cellReplaces[0]?.cells).toHaveLength(4);
  const again = planPlace(withBuilding(grassWorld(), placed.buildings[0]), { definitionId: "B-001", x: 16, y: 12, rotation: 0 }, { ...IDS, instanceId: "33333333-3333-4333-8333-333333333333" });
  expect(again.ok).toBe(true);
  if (!again.ok) {
    return;
  }
  expect(again.result).toMatchObject({ state: "UNDER_CONSTRUCTION", cost: 180, population: 16 });
  expect(again.buildings[0]?.constructionCompletesAt).toBe(NOW + 30_000);
});

test("placement reports population cap and insufficient coins from canPlace", () => {
  const capped = planPlace(grassWorld({ population: 48 }), { definitionId: "B-001", x: 12, y: 12, rotation: 0 }, IDS);
  expect(capped).toMatchObject({ ok: false, status: 422, code: "POP_CAP_REACHED" });
  const owned = planPlace(grassWorld(), { definitionId: "B-001", x: 12, y: 12, rotation: 0 }, IDS);
  if (!owned.ok) {
    throw new Error("cottage should place");
  }
  const broke = planPlace(
    { ...withBuilding(grassWorld({ coins: 100 }), owned.buildings[0]), city: { ...grassWorld({ coins: 100 }).city, population: 8 } },
    { definitionId: "B-001", x: 16, y: 12, rotation: 0 },
    { ...IDS, instanceId: "33333333-3333-4333-8333-333333333333" },
  );
  expect(broke).toMatchObject({ ok: false, status: 409, code: "INSUFFICIENT_COINS" });
});

test("move is free and remove refunds half the price paid inside ten seconds", () => {
  const placed = planPlace(grassWorld(), { definitionId: "B-007", x: 12, y: 12, rotation: 0 }, IDS);
  if (!placed.ok) {
    throw new Error("bakery should place");
  }
  const bakeryPlaced = must(placed.buildings[0], "bakery");
  const world = withBuilding(grassWorld(), bakeryPlaced);
  const moved = planMove(world, { instanceId: bakeryPlaced.id, x: 14, y: 14, rotation: 1 }, IDS);
  expect(moved.ok).toBe(true);
  if (!moved.ok) {
    return;
  }
  expect(moved.ledger).toEqual([]);
  expect(moved.result).toMatchObject({ undoToken: "undo-1", x: 14, y: 14, rotation: 1 });
  const paid = planPlace(world, { definitionId: "AG-001", x: 18, y: 18, rotation: 0 }, { ...IDS, instanceId: "44444444-4444-4444-8444-444444444444" });
  if (!paid.ok) {
    throw new Error("wheat should place");
  }
  expect(paid.buildings[0]?.state).toBe("ACTIVE");
  expect(paid.buildings[0]?.constructionCompletesAt).toBe(NOW + 180_000);
  const paidPlot = must(paid.buildings[0], "wheat");
  const seeded = withBuilding(withBuilding(grassWorld(), wheat({ id: "wheat-a", x: 0 })), paidPlot);
  const removed = planRemove(seeded, { instanceId: paidPlot.id });
  expect(removed.ok).toBe(true);
  if (!removed.ok) {
    return;
  }
  expect(removed.ledger).toEqual([expect.objectContaining({ resource: "COINS", delta: 10, source: "building_removed" })]);
  const removedBuilding = must(removed.buildings[0], "removed wheat");
  const undone = planRemove(
    { ...withBuilding(seeded, removedBuilding), now: NOW + 9_000 },
    { instanceId: paidPlot.id, undo: true },
  );
  expect(undone.ok).toBe(true);
  if (!undone.ok) {
    return;
  }
  expect(undone.ledger).toEqual([expect.objectContaining({ resource: "COINS", delta: -10 })]);
  expect(undone.cellReplaces[0]?.cells).toHaveLength(4);
  const late = planRemove(
    { ...withBuilding(seeded, removedBuilding), now: NOW + 11_000 },
    { instanceId: paidPlot.id, undo: true },
  );
  expect(late).toMatchObject({ ok: false, code: "STATE_CHANGED" });
  expect(planRemove(grassWorld(), { instanceId: "hall" })).toMatchObject({ ok: false, code: "TOWN_HALL" });
  const bare = grassWorld();
  expect(
    planRemove(
      { ...bare, buildings: [...bare.buildings.filter((entry) => entry.definitionId !== "AG-001"), wheat({ id: "only-wheat", x: 0 })] },
      { instanceId: "only-wheat" },
    ),
  ).toMatchObject({
    ok: false,
    code: "LAST_WHEAT_PLOT",
  });
});

test("production queues two slots, cancels with a refund, and shifts the rest", () => {
  expect(productionSlotCount(1)).toBe(2);
  expect(productionSlotCount(5)).toBe(3);
  const bakery = building({ id: "bakery", definitionId: "B-007", x: 12, y: 12, state: "ACTIVE" });
  const world = { ...withBuilding(grassWorld(), bakery), balances: { GOOD_WHEAT: 6 } };
  const first = planStartProduction(world, { instanceId: "bakery", recipeId: "RCP-BREAD" }, IDS);
  expect(first.ok).toBe(true);
  if (!first.ok) {
    return;
  }
  const firstJob = must(first.jobs[0], "first job");
  expect(firstJob).toMatchObject({ slot: 0, startedAt: NOW, completesAt: NOW + 360_000 });
  expect(first.ledger).toEqual([expect.objectContaining({ resource: "GOOD_WHEAT", delta: -2 })]);
  const queued = withJob(
    { ...world, buildings: [...world.buildings.filter((entry) => entry.id !== "bakery"), ...first.buildings] },
    firstJob,
  );
  const second = planStartProduction(
    { ...queued, balances: { GOOD_WHEAT: 4 } },
    { instanceId: "bakery", recipeId: "RCP-BREAD" },
    { ...IDS, jobId: "55555555-5555-4555-8555-555555555555" },
  );
  expect(second.ok).toBe(true);
  if (!second.ok) {
    return;
  }
  const secondJob = must(second.jobs[0], "second job");
  expect(secondJob.startedAt).toBe(NOW + 360_000);
  const both = [firstJob, secondJob];
  const shifted = shiftQueue(both, firstJob.id, NOW + 1_000);
  expect(shifted[0]).toMatchObject({ id: secondJob.id, slot: 0, startedAt: NOW + 1_000 });
  const cancelled = planCancelProduction(withJobs(queued, both), { instanceId: "bakery", jobId: firstJob.id });
  expect(cancelled.ok).toBe(true);
  if (!cancelled.ok) {
    return;
  }
  expect(cancelled.ledger).toEqual([expect.objectContaining({ resource: "GOOD_WHEAT", delta: 2, source: "production_cancelled" })]);
  expect(planStartProduction(world, { instanceId: "bakery", recipeId: "RCP-BREAD" }, IDS)).toMatchObject({ ok: true });
  expect(planStartProduction({ ...world, balances: {} }, { instanceId: "bakery", recipeId: "RCP-BREAD" }, IDS)).toMatchObject({
    ok: false,
    code: "INSUFFICIENT_GOODS",
  });
});

test("supply starts a ten second tutorial cycle and projects the shared business reward", () => {
  const grocery = building({ id: "grocery", definitionId: "B-004", x: 9, y: 4, state: "NEEDS_SUPPLY" });
  const supplied = planSupply({ ...withBuilding(grassWorld(), grocery), balances: { GOOD_BREAD: 3 } }, { instanceId: "grocery" });
  expect(supplied.ok).toBe(true);
  if (!supplied.ok) {
    return;
  }
  expect(supplied.result).toMatchObject({ projectedCoins: 110, cycleSeconds: 10, state: "ACTIVE", supplied: { GOOD_BREAD: 3 } });
  expect(supplied.ledger).toEqual([expect.objectContaining({ resource: "GOOD_BREAD", delta: -3, source: "business_supplied" })]);
  const running = supplied.buildings[0];
  if (running === undefined) {
    throw new Error("grocery missing");
  }
  const early = resolveTimers({ ...withBuilding(grassWorld(), running), now: NOW + 9_000, balances: {} });
  expect(early.buildings).toEqual([]);
  const done = resolveTimers({ ...withBuilding(grassWorld(), running), now: NOW + 10_000, balances: {} });
  expect(done.buildings[0]?.stock.pendingCoins).toBe(110);
  expect(done.buildings[0]?.stock.goods.GOOD_BREAD).toBeUndefined();
});

test("lazy timers finish construction, hold a ripe plot, and cap rent and sales at twelve hours", () => {
  const constructing = building({
    id: "row",
    definitionId: "B-002",
    x: 12,
    y: 12,
    state: "UNDER_CONSTRUCTION",
    constructionCompletesAt: NOW - 1_000,
  });
  const finished = resolveTimers(withBuilding(grassWorld({ level: 4, coins: 10_000 }), constructing));
  expect(finished.buildings[0]?.state).toBe("ACTIVE");

  const plot = building({
    id: "plot",
    definitionId: "AG-001",
    x: 0,
    y: 2,
    state: "ACTIVE",
    constructionCompletesAt: NOW - 2 * 24 * 60 * 60 * 1000,
    cycleStartedAt: NOW - 2 * 24 * 60 * 60 * 1000,
  });
  const ripe = resolveTimers(withBuilding(grassWorld(), plot));
  expect(ripe.buildings[0]).toMatchObject({ state: "READY_TO_COLLECT", outputReady: { goodId: "GOOD_WHEAT", qty: 3 } });
  const waiting = applyTimerChanges(withBuilding(grassWorld(), plot), ripe);
  const later = resolveTimers({ ...waiting, now: NOW + 5 * 24 * 60 * 60 * 1000 });
  expect(later.buildings.find((entry) => entry.id === "plot")).toBeUndefined();

  const cottage = building({
    id: "home",
    definitionId: "B-001",
    x: 12,
    y: 12,
    state: "ACTIVE",
    lastCollectedAt: NOW - 2 * 24 * 60 * 60 * 1000,
  });
  const rent = planCollect(withBuilding(grassWorld(), cottage), {});
  expect(rent.ok).toBe(true);
  if (!rent.ok) {
    return;
  }
  expect(rent.result).toMatchObject({ coins: 90 * 32, xp: 0 });

  const grocery = building({
    id: "grocery",
    definitionId: "B-004",
    x: 9,
    y: 4,
    state: "ACTIVE",
    cycleStartedAt: NOW - 2 * 24 * 60 * 60 * 1000,
    lastCollectedAt: NOW - 2 * 24 * 60 * 60 * 1000,
    stock: { goods: { GOOD_BREAD: 300 }, pendingCoins: 0, tutorialCycle: false, tutorialUsed: true, paidCoins: 500 },
  });
  const sales = resolveTimers(withBuilding(grassWorld(), grocery));
  const pending = sales.buildings[0]?.stock.pendingCoins ?? 0;
  const cappedCycles = Math.floor(PASSIVE_CAP_SECONDS / 600);
  expect(pending).toBe(cappedCycles * businessReward({ baseCoins: 110, level: 1, decorationBoost: 0, roadBonus: 0 }));
  expect(sales.buildings[0]?.stock.goods.GOOD_BREAD).toBe(300 - cappedCycles * 3);
  expect(sales.buildings[0]?.cycleStartedAt).toBeNull();
});

test("rent past twelve hours is paid once and the overflow is dropped", () => {
  const capCoins = 90 * 32;
  for (const awayHours of [13, 24, 48]) {
    const cottage = building({
      id: "home",
      definitionId: "B-001",
      x: 12,
      y: 12,
      state: "ACTIVE",
      lastCollectedAt: NOW - awayHours * 60 * 60 * 1000,
    });
    const first = planCollect(withBuilding(grassWorld(), cottage), { instanceId: "home" });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.result).toMatchObject({ coins: capCoins });
    expect(first.buildings[0]?.lastCollectedAt).toBe(NOW);
    const settled = withBuilding(grassWorld(), first.buildings[0]);
    const second = planCollect(settled, { instanceId: "home" });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.result).toMatchObject({ coins: 0 });
    expect(second.ledger).toEqual([]);
  }

  const partial = building({
    id: "home",
    definitionId: "B-001",
    x: 12,
    y: 12,
    state: "ACTIVE",
    lastCollectedAt: NOW - 480_000 - 100_000,
  });
  const kept = planCollect(withBuilding(grassWorld(), partial), { instanceId: "home" });
  expect(kept.ok).toBe(true);
  if (!kept.ok) {
    return;
  }
  expect(kept.result).toMatchObject({ coins: 32 });
  expect(kept.buildings[0]?.lastCollectedAt).toBe(NOW - 100_000);
  const later = planCollect({ ...withBuilding(grassWorld(), kept.buildings[0]), now: NOW + 380_000 }, { instanceId: "home" });
  expect(later.ok).toBe(true);
  if (!later.ok) {
    return;
  }
  expect(later.result).toMatchObject({ coins: 32 });
});

test("ledger guards refuse a second payout", () => {
  const placed = planPlace(grassWorld(), { definitionId: "B-001", x: 12, y: 12, rotation: 0 }, IDS);
  expect(placed.ok).toBe(true);
  if (!placed.ok) {
    return;
  }
  const cottage = must(placed.buildings[0], "cottage");
  const removed = planRemove(withBuilding(grassWorld(), cottage), { instanceId: cottage.id });
  expect(removed.ok).toBe(true);
  if (!removed.ok) {
    return;
  }
  expect(removed.result).toMatchObject({ refund: 0 });
  expect(removed.ledger.filter((entry) => entry.resource === "COINS")).toEqual([]);
  const again = planRemove(withBuilding(grassWorld(), removed.buildings[0]), { instanceId: cottage.id });
  expect(again).toMatchObject({ ok: false, code: "STATE_CHANGED" });

  const paid = planPlace(grassWorld(), { definitionId: "AG-001", x: 18, y: 18, rotation: 0 }, { ...IDS, instanceId: "44444444-4444-4444-8444-444444444444" });
  expect(paid.ok).toBe(true);
  if (!paid.ok) {
    return;
  }
  const plot = must(paid.buildings[0], "wheat");
  const seeded = withBuilding(grassWorld(), plot);
  const sold = planRemove(seeded, { instanceId: plot.id });
  expect(sold.ok).toBe(true);
  if (!sold.ok) {
    return;
  }
  const broke = planRemove(
    { ...withBuilding(seeded, sold.buildings[0]), city: { ...seeded.city, coins: 9 }, now: NOW + 1_000 },
    { instanceId: plot.id, undo: true },
  );
  expect(broke).toMatchObject({ ok: false, code: "INSUFFICIENT_COINS" });

  const hidden = {
    ...building({
      id: "home",
      definitionId: "B-001",
      x: 12,
      y: 12,
      state: "ACTIVE",
      lastCollectedAt: NOW - 2 * 24 * 60 * 60 * 1000,
      outputReady: { goodId: "GOOD_BREAD", qty: 3 },
    }),
    removedAt: NOW - 1_000,
    undoExpiresAt: NOW + 9_000,
  };
  const skipped = planCollect(withBuilding(grassWorld(), hidden), {});
  expect(skipped.ok).toBe(true);
  if (!skipped.ok) {
    return;
  }
  expect(skipped.ledger.filter((entry) => entry.resource === "COINS" || entry.resource === "GOOD_BREAD")).toEqual([]);

  const bakery = building({ id: "bakery", definitionId: "B-007", x: 12, y: 12, state: "ACTIVE" });
  const producing = { ...withBuilding(grassWorld(), bakery), balances: { GOOD_WHEAT: 10 } };
  const first = planStartProduction(producing, { instanceId: "bakery", recipeId: "RCP-BREAD" }, IDS);
  expect(first.ok).toBe(true);
  if (!first.ok) {
    return;
  }
  const second = planStartProduction(
    withJob(producing, first.jobs[0]),
    { instanceId: "bakery", recipeId: "RCP-BREAD" },
    { ...IDS, jobId: "55555555-5555-4555-8555-555555555555" },
  );
  expect(second.ok).toBe(true);
  if (!second.ok) {
    return;
  }
  const third = planStartProduction(
    withJobs(producing, [first.jobs[0], second.jobs[0]]),
    { instanceId: "bakery", recipeId: "RCP-BREAD" },
    { ...IDS, jobId: "66666666-6666-4666-8666-666666666666" },
  );
  expect(third).toMatchObject({ ok: false, code: "STATE_CHANGED" });
  const finished = must(first.jobs[0], "finished job");
  const cancelled = planCancelProduction(withJob(producing, { ...finished, movedToOutputAt: NOW }), {
    instanceId: "bakery",
    jobId: finished.id,
  });
  expect(cancelled).toMatchObject({ ok: false, code: "STATE_CHANGED" });

  const grocery = building({
    id: "grocery",
    definitionId: "B-004",
    x: 16,
    y: 16,
    state: "NEEDS_SUPPLY",
    stock: { goods: { GOOD_WHEAT: 7 }, pendingCoins: 0, tutorialCycle: false, tutorialUsed: true },
  });
  const supplied = planSupply({ ...withBuilding(grassWorld(), grocery), balances: { GOOD_BREAD: 30 } }, { instanceId: "grocery" });
  expect(supplied.ok).toBe(true);
  if (!supplied.ok) {
    return;
  }
  expect(supplied.ledger).toEqual([expect.objectContaining({ resource: "GOOD_BREAD", delta: -2, source: "business_supplied" })]);
  expect(supplied.buildings[0]?.stock.goods).toMatchObject({ GOOD_WHEAT: 7, GOOD_BREAD: 2 });
});

test("collect keeps leftover output when the warehouse is full and prefers quest goods", () => {
  const wheatReady = building({
    id: "wheat",
    definitionId: "AG-001",
    x: 0,
    y: 0,
    state: "READY_TO_COLLECT",
    outputReady: { goodId: "GOOD_WHEAT", qty: 3 },
    constructionCompletesAt: NOW - 1_000,
  });
  const breadReady = building({
    id: "bakery",
    definitionId: "B-007",
    x: 12,
    y: 12,
    state: "READY_TO_COLLECT",
    outputReady: { goodId: "GOOD_BREAD", qty: 3 },
    createdAt: NOW - 5_000,
  });
  const base = grassWorld({ collectPriority: "QUEST_FIRST", warehouseCap: 2 });
  const world = {
    ...withBuilding(withBuilding({ ...base, buildings: base.buildings.filter((entry) => entry.definitionId !== "AG-001") }, wheatReady), breadReady),
    balances: { GOOD_BREAD: 0 },
    quests: [{ questId: "quest_early_bakery_01", status: "ACTIVE" as const, stepIndex: 1, stepState: { "0": 1, "1": 0 } }],
  };
  const collected = planCollect(world, {});
  expect(collected.ok).toBe(true);
  if (!collected.ok) {
    return;
  }
  expect(collected.result).toMatchObject({
    goods: { GOOD_BREAD: 2 },
    collected: 2,
    remaining: 4,
    warehouseFull: true,
  });
  expect(collected.buildings.find((entry) => entry.id === "bakery")?.outputReady).toEqual({ goodId: "GOOD_BREAD", qty: 1 });
  expect(collected.buildings.find((entry) => entry.id === "wheat")).toBeUndefined();
});

test("a finished harvest auto-replants and a completed job moves into output ready", () => {
  const plot = building({
    id: "plot",
    definitionId: "AG-001",
    x: 0,
    y: 2,
    state: "READY_TO_COLLECT",
    outputReady: { goodId: "GOOD_WHEAT", qty: 3 },
    constructionCompletesAt: NOW - 2 * 24 * 60 * 60 * 1000,
  });
  const harvested = planCollect(withBuilding(grassWorld(), plot), { instanceId: "plot" });
  expect(harvested.ok).toBe(true);
  if (!harvested.ok) {
    return;
  }
  expect(harvested.result).toMatchObject({ goods: { GOOD_WHEAT: 3 }, collected: 3, remaining: 0, warehouseFull: false });
  expect(harvested.buildings[0]).toMatchObject({ state: "ACTIVE", outputReady: null, cycleStartedAt: NOW, constructionCompletesAt: NOW + 180_000 });

  const bakery = building({ id: "bakery", definitionId: "B-007", x: 12, y: 12, state: "PRODUCING" });
  const job: WorldJob = {
    id: "job-1",
    buildingId: "bakery",
    slot: 0,
    recipeId: "RCP-BREAD",
    inputs: [{ goodId: "GOOD_WHEAT", qty: 2 }],
    outputs: { goodId: "GOOD_BREAD", qty: 3 },
    startedAt: NOW - 400_000,
    completesAt: NOW - 1_000,
    movedToOutputAt: null,
    cancelledAt: null,
  };
  const resolved = resolveTimers(withJob(withBuilding(grassWorld(), bakery), job));
  expect(resolved.jobs[0]?.movedToOutputAt).toBe(NOW);
  expect(resolved.buildings[0]).toMatchObject({ state: "READY_TO_COLLECT", outputReady: { goodId: "GOOD_BREAD", qty: 3 } });
});

test("snapshot reloads when the client version is outside the retention window", () => {
  expect(wantsFullSnapshot({ sinceVersion: null, cityVersion: 4, updatedAtMs: NOW, nowMs: NOW })).toBe(true);
  expect(wantsFullSnapshot({ sinceVersion: 0, cityVersion: 4, updatedAtMs: NOW, nowMs: NOW })).toBe(true);
  expect(wantsFullSnapshot({ sinceVersion: 3, cityVersion: 4, updatedAtMs: NOW, nowMs: NOW })).toBe(false);
  expect(wantsFullSnapshot({ sinceVersion: 3, cityVersion: 4, updatedAtMs: NOW - 25 * 60 * 60 * 1000, nowMs: NOW })).toBe(true);
  expect(wantsFullSnapshot({ sinceVersion: 4, cityVersion: 4, updatedAtMs: NOW - 25 * 60 * 60 * 1000, nowMs: NOW })).toBe(false);
  expect(wantsFullSnapshot({ sinceVersion: 1, cityVersion: 200, updatedAtMs: NOW, nowMs: NOW })).toBe(true);
});

test.each([13, 24, 48])("rent beyond the offline cap is discarded after %i hours", (hours) => {
  const home = building({ id: "home", definitionId: "B-001", x: 12, y: 12, state: "ACTIVE", lastCollectedAt: NOW - hours * 3_600_000 });
  const world = withBuilding(grassWorld(), home);
  const first = planCollect(world, { instanceId: home.id });
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(first.result).toMatchObject({ coins: 2880 });
  const second = planCollect(withBuilding(world, must(first.buildings[0], "collected home")), { instanceId: home.id });
  expect(second).toMatchObject({ ok: true, result: { coins: 0 }, ledger: [] });
});

test("removed buildings cannot be refunded twice or collected", () => {
  const home = building({ id: "home", definitionId: "B-001", x: 12, y: 12, state: "ACTIVE", lastCollectedAt: NOW - 3_600_000, stock: { goods: {}, pendingCoins: 50, tutorialCycle: false, tutorialUsed: false, paidCoins: 100 } });
  const world = withBuilding(grassWorld(), home);
  const first = planRemove(world, { instanceId: home.id });
  expect(first).toMatchObject({ ok: true, result: { refund: 50 } });
  if (!first.ok) return;
  const removedWorld = withBuilding(world, must(first.buildings[0], "removed home"));
  expect(planRemove(removedWorld, { instanceId: home.id })).toMatchObject({ ok: false, code: "STATE_CHANGED" });
  expect(planCollect({ ...removedWorld, buildings: removedWorld.buildings.filter((entry) => entry.id === home.id) }, {})).toMatchObject({ ok: true, result: { coins: 0 }, ledger: [] });
});

test("removal uses paid coins and undo requires enough coins", () => {
  const home = building({ id: "home", definitionId: "B-001", x: 12, y: 12, state: "ACTIVE", stock: { goods: {}, pendingCoins: 0, tutorialCycle: false, tutorialUsed: false, paidCoins: 70 } });
  const world = withBuilding(grassWorld({ coins: 34 }), home);
  const removed = planRemove(world, { instanceId: home.id });
  expect(removed).toMatchObject({ ok: true, result: { refund: 35 }, ledger: [{ delta: 35 }] });
  if (!removed.ok) return;
  const undo = planRemove(withBuilding(world, must(removed.buildings[0], "removed home")), { instanceId: home.id, undo: true });
  expect(undo).toMatchObject({ ok: false, code: "INSUFFICIENT_COINS" });
});

test("a full production queue rejects another job and a completed job cannot be cancelled", () => {
  const bakery = building({ id: "bakery", definitionId: "B-007", x: 12, y: 12, state: "ACTIVE" });
  const world = { ...withBuilding(grassWorld(), bakery), balances: { GOOD_WHEAT: 10 } };
  const first = planStartProduction(world, { instanceId: bakery.id, recipeId: "RCP-BREAD" }, IDS);
  if (!first.ok) throw new Error("first job failed");
  const job = must(first.jobs[0], "job");
  const queued = withJobs(world, [job, { ...job, id: "second", slot: 1 }]);
  expect(planStartProduction(queued, { instanceId: bakery.id, recipeId: "RCP-BREAD" }, IDS)).toMatchObject({ ok: false, code: "STATE_CHANGED" });
  expect(planCancelProduction(withJob(world, { ...job, movedToOutputAt: NOW }), { instanceId: bakery.id, jobId: job.id })).toMatchObject({ ok: false, code: "STATE_CHANGED" });
});

test("supply does not exceed the business input capacity", () => {
  const grocery = building({ id: "grocery", definitionId: "B-004", x: 12, y: 12, state: "NEEDS_SUPPLY", stock: { goods: { GOOD_WHEAT: 8 }, pendingCoins: 0, tutorialCycle: false, tutorialUsed: false } });
  const result = planSupply({ ...withBuilding(grassWorld(), grocery), balances: { GOOD_BREAD: 9 } }, { instanceId: grocery.id });
  expect(result).toMatchObject({ ok: true, result: { supplied: { GOOD_BREAD: 1 } }, ledger: [{ resource: "GOOD_BREAD", delta: -1 }] });
});

function grassWorld(overrides?: Partial<World["city"]> & { coins?: number; population?: number }): World {
  const cells: WorldCell[] = [];
  for (let y = 0; y < 24; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      cells.push({ x, y, terrain: "grass" });
    }
  }
  const hall = building({ id: "hall", definitionId: "B-009", x: 4, y: 4, state: "ACTIVE" });
  for (let dy = 0; dy < 4; dy += 1) {
    for (let dx = 0; dx < 4; dx += 1) {
      const index = (hall.y + dy) * 24 + hall.x + dx;
      const cell = cells[index];
      if (cell !== undefined) {
        cells[index] = { ...cell, occupantId: hall.id };
      }
    }
  }
  return {
    now: NOW,
    city: {
      id: "city",
      level: overrides?.level ?? 1,
      xp: 0,
      coins: overrides?.coins ?? 750,
      gems: 0,
      civicStars: 0,
      version: 1,
      population: overrides?.population ?? 0,
      populationCap: 50,
      warehouseCap: overrides?.warehouseCap ?? 40,
      collectPriority: overrides?.collectPriority ?? "QUEST_FIRST",
      tutorialState: { step: "place_house", guideNpcId: "NPC-MIA" },
      unlockedChunks: [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      width: 24,
      height: 24,
    },
    cells,
    buildings: [hall, wheat({ id: "starter-wheat", x: 0 }), wheat({ id: "starter-wheat-2", x: 2 })],
    jobs: [],
    balances: {},
    quests: [],
  };
}

function withBuilding(world: World, building: WorldBuilding | undefined): World {
  if (building === undefined) {
    return world;
  }
  const cells = world.cells.map((cell) => (cell.occupantId === building.id ? { ...cell, occupantId: undefined } : cell));
  if (building.removedAt === null) {
    for (const covered of footprintOf(building)) {
      const index = covered.y * world.city.width + covered.x;
      const cell = cells[index];
      if (cell !== undefined) {
        cells[index] = { ...cell, occupantId: building.id };
      }
    }
  }
  const buildings = world.buildings.filter((entry) => entry.id !== building.id);
  return { ...world, cells, buildings: [...buildings, building] };
}

function withJob(world: World, job: WorldJob | undefined): World {
  if (job === undefined) {
    return world;
  }
  return { ...world, jobs: [...world.jobs.filter((entry) => entry.id !== job.id), job] };
}

function withJobs(world: World, jobs: readonly (WorldJob | undefined)[]): World {
  return jobs.reduce<World>((current, job) => withJob(current, job), world);
}

function wheat(input: { id: string; x: number }): WorldBuilding {
  return building({
    id: input.id,
    definitionId: "AG-001",
    x: input.x,
    y: 0,
    state: "READY_TO_COLLECT",
    outputReady: { goodId: "GOOD_WHEAT", qty: 3 },
  });
}

function building(input: {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  state: WorldBuilding["state"];
  constructionCompletesAt?: number | null;
  cycleStartedAt?: number | null;
  lastCollectedAt?: number | null;
  outputReady?: WorldBuilding["outputReady"];
  stock?: WorldBuilding["stock"];
  createdAt?: number;
}): WorldBuilding {
  return {
    id: input.id,
    definitionId: input.definitionId,
    level: 1,
    x: input.x,
    y: input.y,
    rotation: 0,
    state: input.state,
    constructionCompletesAt: input.constructionCompletesAt ?? null,
    cycleStartedAt: input.cycleStartedAt ?? null,
    lastCollectedAt: input.lastCollectedAt ?? null,
    stock: input.stock ?? { goods: {}, pendingCoins: 0, tutorialCycle: false, tutorialUsed: false },
    outputReady: input.outputReady ?? null,
    removedAt: null,
    undoExpiresAt: null,
    createdAt: input.createdAt ?? NOW,
  };
}

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} is missing`);
  }
  return value;
}

function footprintOf(entry: WorldBuilding): readonly { readonly x: number; readonly y: number }[] {
  const width = entry.definitionId === "B-009" ? 4 : entry.definitionId === "B-002" ? 2 : 2;
  const height = entry.definitionId === "B-009" ? 4 : 2;
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      cells.push({ x: entry.x + dx, y: entry.y + dy });
    }
  }
  return cells;
}
