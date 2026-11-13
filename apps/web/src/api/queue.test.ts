import { describe, expect, it } from "vitest";
import { composeSnapshot } from "./queue";
import type { Snapshot } from "@nf/shared/schemas";

describe("pending city commands", () => {
  it("composes pending placement over the server snapshot without changing it", () => {
    const snapshot = { buildings: [] } as unknown as Snapshot;
    const visible = composeSnapshot(snapshot, [{ key: "key", name: "place-building", body: { definitionId: "B-001", x: 2, y: 3, rotation: 0 } }]);
    expect(visible.buildings).toHaveLength(1);
    expect(visible.buildings[0]).toMatchObject({ definitionId: "B-001", x: 2, y: 3 });
    expect(snapshot.buildings).toHaveLength(0);
  });
});

it("composes movement, removal, production, supply and collection without changing the server snapshot", () => {
  const building = (id: string, state: string) => ({ id, definitionId: "B-007", x: 0, y: 0, rotation: 0, state, level: 1, version: 0 });
  const snapshot = { buildings: [building("a", "READY_TO_COLLECT"), building("b", "NEEDS_SUPPLY"), building("c", "ACTIVE")], jobs: [], serverNow: "2026-01-01T00:00:00.000Z" } as unknown as Snapshot;
  const result = composeSnapshot(snapshot, [
    { key: "1", name: "move-building", body: { instanceId: "a", x: 4, y: 3, rotation: 1 } },
    { key: "2", name: "collect", body: { instanceId: "a" } },
    { key: "3", name: "supply-business", body: { instanceId: "b" } },
    { key: "4", name: "remove-building", body: { instanceId: "b" } },
    { key: "5", name: "remove-building", body: { instanceId: "b", undo: true } },
    { key: "6", name: "start-production", body: { instanceId: "c", recipeId: "RCP-BREAD" } },
  ]);
  expect(result.buildings.find(b => b.id === "a")).toMatchObject({ x: 4, y: 3, rotation: 1, state: "ACTIVE" });
  expect(result.buildings.find(b => b.id === "b")?.state).toBe("ACTIVE");
  expect(result.buildings.find(b => b.id === "c")?.state).toBe("PRODUCING");
  expect(result.jobs).toHaveLength(1);
  const cancelled = composeSnapshot(snapshot, [{ key: "6", name: "start-production", body: { instanceId: "c", recipeId: "RCP-BREAD" } }, { key: "7", name: "cancel-production", body: { instanceId: "c", jobId: "pending:6" } }, { key: "8", name: "collect-all", body: {} }]);
  expect(cancelled.jobs).toHaveLength(0);
  expect(cancelled.buildings.find(b => b.id === "a")?.state).toBe("ACTIVE");
  expect(snapshot.buildings[0]?.state).toBe("READY_TO_COLLECT");
});

it("removes immediately and returns a cancelled building to active", () => {
  const snapshot = { city: { level: 1 }, serverNow: "2026-01-01T00:00:00.000Z", buildings: [{ id: "a", definitionId: "B-007", state: "PRODUCING" }], jobs: [{ id: "job", buildingId: "a", slot: 0 }] } as unknown as Snapshot;
  const removed = composeSnapshot(snapshot, [{ key: "r", name: "remove-building", body: { instanceId: "a" } }]);
  expect(removed.buildings).toHaveLength(0);
  const cancelled = composeSnapshot(snapshot, [{ key: "c", name: "cancel-production", body: { instanceId: "a", jobId: "job" } }]);
  expect(cancelled.jobs).toHaveLength(0);
  expect(cancelled.buildings[0]?.state).toBe("ACTIVE");
});

it("limits queued production to two slots until level five", () => {
  const snapshot = { city: { level: 4 }, serverNow: "2026-01-01T00:00:00.000Z", buildings: [{ id: "a", definitionId: "B-007", state: "ACTIVE" }], jobs: [] } as unknown as Snapshot;
  const commands = ["1", "2", "3"].map(key => ({ key, name: "start-production" as const, body: { instanceId: "a", recipeId: "RCP-BREAD" as const } }));
  expect(composeSnapshot(snapshot, commands).jobs).toHaveLength(2);
  expect(composeSnapshot({ ...snapshot, city: { ...snapshot.city, level: 5 } }, commands).jobs).toHaveLength(3);
});

it("applies order rewards and inventory once and hides rerolled cards", () => {
  const snapshot = { buildings: [], jobs: [], city: { coins: 750, xp: 0, civicStars: 0 }, inventory: { GOOD_BREAD: 3 }, orders: [
    { id: "a", status: "OPEN", requirements: { GOOD_BREAD: 3 }, reward: { coins: 180, xp: 12, civicStars: 1 } },
    { id: "b", status: "OPEN", requirements: {}, reward: { coins: 0, xp: 0, civicStars: 0 } },
  ] } as unknown as Snapshot;
  const result = composeSnapshot(snapshot, [{ key: "1", name: "fulfill-order", body: { orderId: "a" } }, { key: "2", name: "reroll-order", body: { orderId: "b" } }]);
  expect(result.city).toMatchObject({ coins: 930, xp: 12, civicStars: 1 });
  expect(result.inventory.GOOD_BREAD).toBe(0);
  expect(result.orders.map(o => o.status)).toEqual(["FULFILLED", "REROLLED"]);
  expect(snapshot.inventory.GOOD_BREAD).toBe(3);
});


it("rerolls without consuming goods or granting rewards, and ignores closed orders", () => {
  const order = { id: "a", status: "OPEN", requirements: { GOOD_BREAD: 3 }, reward: { coins: 180, xp: 12, civicStars: 1 } };
  const snapshot = { buildings: [], jobs: [], city: { coins: 750, xp: 4, civicStars: 2 }, inventory: { GOOD_BREAD: 5 }, orders: [order] } as unknown as Snapshot;
  const rerolled = composeSnapshot(snapshot, [{ key: "1", name: "reroll-order", body: { orderId: "a" } }]);
  expect(rerolled.city).toEqual(snapshot.city);
  expect(rerolled.inventory).toEqual(snapshot.inventory);
  expect(rerolled.orders[0]?.status).toBe("REROLLED");
  for (const status of ["FULFILLED", "REROLLED"] as const) {
    const closed = { ...snapshot, orders: [{ ...order, status }] } as Snapshot;
    for (const name of ["fulfill-order", "reroll-order"] as const) {
      const result = composeSnapshot(closed, [{ key: name, name, body: { orderId: "a" } }]);
      expect(result.city).toEqual(closed.city);
      expect(result.inventory).toEqual(closed.inventory);
      expect(result.orders).toEqual(closed.orders);
    }
  }
});

it("optimistically claims a completed quest once", () => {
  const snapshot = { buildings: [], jobs: [], inventory: {}, city: { coins: 750, xp: 0 }, quests: [{ questId: "quest_early_bakery_01", periodKey: "-", status: "COMPLETED" }] } as unknown as Snapshot;
  const command = { key: "1", name: "claim-quest", body: { questId: "quest_early_bakery_01", periodKey: "-" } } as const;
  const result = composeSnapshot(snapshot, [command, command]);
  expect(result.city).toMatchObject({ coins: 900, xp: 25 });
  expect(result.quests[0]?.status).toBe("CLAIMED");
});
