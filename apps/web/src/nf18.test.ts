import { describe, expect, it } from "vitest";
import { readSettings, saveSettings } from "./settings";
import { buildingStatus, statusIcon } from "./components/buildingStatus";
import { usePlacementStore, useSceneStore } from "./game/scene-store";

describe("NF-18 state", () => {
  it("preserves legacy settings and persists collect priority", () => {
    let value = '{"musicMuted":true}';
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    expect(readSettings(storage)).toMatchObject({ musicMuted: true, collectPriority: "QUEST_FIRST" });
    saveSettings(storage, { ...readSettings(storage), collectPriority: "OLDEST_FIRST" });
    expect(readSettings(storage).collectPriority).toBe("OLDEST_FIRST");
  });
  it("uses snapshot priority for missing or old saved values", () => {
    for (const priority of ["default", "buildings", "production"]) {
      const storage = { getItem: () => JSON.stringify({ collectPriority: priority }), setItem: () => {} };
      expect(readSettings(storage, "OLDEST_FIRST").collectPriority).toBe("OLDEST_FIRST");
    }
  });
  it("uses distinct status icons", () => {
    const states = ["PRODUCING", "READY_TO_COLLECT", "NEEDS_SUPPLY", "UNDER_CONSTRUCTION", "UPGRADING", "RELOCATING", "ACTIVE"] as const;
    expect(new Set(states.map(statusIcon)).size).toBe(states.length);
  });
  it("maps building states to readable status", () => {
    expect(buildingStatus("PRODUCING")).toBe("Producing");
    expect(buildingStatus("READY_TO_COLLECT")).toBe("Ready");
    expect(buildingStatus("NEEDS_SUPPLY")).toBe("Needs supply");
    expect(buildingStatus("ACTIVE")).toBe("Idle");
  });
  it("cancels placement when entering photo mode", () => {
    usePlacementStore.getState().select("B-001");
    useSceneStore.getState().publish({ photoMode: true });
    expect(usePlacementStore.getState().catalogId).toBeNull();
    useSceneStore.getState().publish({ photoMode: false });
  });
  it("tracks entering and exiting photo mode", () => {
    useSceneStore.getState().publish({ photoMode: true });
    expect(useSceneStore.getState().photoMode).toBe(true);
    useSceneStore.getState().publish({ photoMode: false });
    expect(useSceneStore.getState().photoMode).toBe(false);
  });
});
