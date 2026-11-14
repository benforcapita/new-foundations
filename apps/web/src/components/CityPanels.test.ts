import { describe, expect, it } from "vitest";
import { BUILDINGS } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import { catalogAvailability, hasReady, canPlaceFlowerBench, canCancelProduction } from "./cityPanelState";

describe("city HUD decisions", () => {
  const snapshot = { city: { level: 1, coins: 200 }, buildings: [] } as unknown as Snapshot;
  it("locks the station at level 1 and allows a free first cottage", () => {
    const station = BUILDINGS.find(b => b.id === "B-011");
    const cottage = BUILDINGS.find(b => b.id === "B-001");
    if (!station || !cottage) throw new Error("Missing catalog definitions");
    expect(catalogAvailability(snapshot, station).locked).toBe(true);
    expect(station.unlockLevel).toBe(3);
    expect(catalogAvailability(snapshot, cottage)).toEqual({ locked: false, affordable: true, cost: 0 });
  });
  it("prices removed first-free buildings using their placement history", () => {
    for (const id of ["B-001", "B-007"]) {
      const definition = BUILDINGS.find(b => b.id === id);
      if (!definition) throw new Error("Missing catalog definition");
      const city = { ...snapshot.city, coins: 100, placedCounts: { [id]: 1 } };
      expect(catalogAvailability({ ...snapshot, city }, definition)).toMatchObject({ cost: definition.cost.coins, affordable: false });
      expect(catalogAvailability({ ...snapshot, city: { ...city, coins: definition.cost.coins } }, definition)).toMatchObject({ cost: definition.cost.coins, affordable: true });
    }
  });
  it("enables collect all only when an instance is ready", () => {
    expect(hasReady(snapshot)).toBe(false);
    expect(hasReady({ ...snapshot, buildings: [{ state: "READY_TO_COLLECT" } as Snapshot["buildings"][number]] })).toBe(true);
  });
});

it("offers the earned Flower Street bench only when absent", () => {
  const quest = { questId: "quest_flower_street", status: "CLAIMED", track: "story", periodKey: "-", version: 1, stepState: { "6": 1 } } as Snapshot["quests"][number];
  const city = { buildings: [], quests: [quest] } as unknown as Snapshot;
  expect(canPlaceFlowerBench(city)).toBe(true);
  expect(canPlaceFlowerBench({ ...city, buildings: [{ definitionId: "D-003" } as Snapshot["buildings"][number]] })).toBe(false);
  expect(canPlaceFlowerBench({ ...city, quests: [{ ...quest, status: "ACTIVE", stepState: {} }] })).toBe(false);
});

it("disables cancellation when a job finishes", () => {
  const job = { id: "job", completesAt: "2026-11-13T12:00:00Z" };
  const finish = Date.parse(job.completesAt);
  expect(canCancelProduction(job, finish - 1)).toBe(true);
  expect(canCancelProduction(job, finish)).toBe(false);
  expect(canCancelProduction(job, finish + 1)).toBe(false);
  expect(canCancelProduction({ ...job, id: "pending:job" }, finish - 1)).toBe(false);
});
