import type { DemoBuilding } from "../../apps/web/src/game/demoCity";

export const BENCH_SIZE = 96;
export const BENCH_DURATION_MS = 30_000;

/** A deterministic grid of non-overlapping cottage footprints. */
export function stressBuildings(): DemoBuilding[] {
  return Array.from({ length: 500 }, (_, index) => ({
    instanceId: `bench-${index}`,
    buildingId: "B-001",
    x: (index % 24) * 4,
    y: Math.floor(index / 24) * 4,
    rotation: 0,
    state: index < 30 ? "READY_TO_COLLECT" : "ACTIVE",
    timerLabel: "",
  }));
}
