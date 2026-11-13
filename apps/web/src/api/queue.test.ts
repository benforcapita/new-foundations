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
