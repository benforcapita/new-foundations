import type { BuildingState } from "@nf/shared";
export function buildingStatus(state: BuildingState): string {
  switch (state) { case "PRODUCING": return "Producing"; case "READY_TO_COLLECT": return "Ready"; case "NEEDS_SUPPLY": return "Needs supply"; case "UNDER_CONSTRUCTION": return "Under construction"; case "UPGRADING": return "Upgrading"; case "RELOCATING": return "Relocating"; default: return "Idle"; }
}
