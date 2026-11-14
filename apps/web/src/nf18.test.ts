import { describe, expect, it } from "vitest";
import { readSettings, saveSettings } from "./settings";
import { buildingStatus } from "./components/buildingStatus";
import { useSceneStore } from "./game/scene-store";

describe("NF-18 state", () => {
  it("preserves legacy settings and persists collect priority", () => {
    let value = '{"musicMuted":true}';
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    expect(readSettings(storage)).toMatchObject({ musicMuted: true, collectPriority: "default" });
    saveSettings(storage, { ...readSettings(storage), collectPriority: "production" });
    expect(readSettings(storage).collectPriority).toBe("production");
  });
  it("maps building states to readable status", () => {
    expect(buildingStatus("PRODUCING")).toBe("Producing");
    expect(buildingStatus("READY_TO_COLLECT")).toBe("Ready");
    expect(buildingStatus("NEEDS_SUPPLY")).toBe("Needs supply");
    expect(buildingStatus("ACTIVE")).toBe("Idle");
  });
  it("tracks entering and exiting photo mode", () => {
    useSceneStore.getState().publish({ photoMode: true });
    expect(useSceneStore.getState().photoMode).toBe(true);
    useSceneStore.getState().publish({ photoMode: false });
    expect(useSceneStore.getState().photoMode).toBe(false);
  });
});
