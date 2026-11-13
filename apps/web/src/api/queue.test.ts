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
