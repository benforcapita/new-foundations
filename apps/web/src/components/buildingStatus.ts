import type { BuildingState } from "@nf/shared";
export function buildingStatus(state: BuildingState): string {
  switch (state) { case "PRODUCING": return "Producing"; case "READY_TO_COLLECT": return "Ready"; case "NEEDS_SUPPLY": return "Needs supply"; case "UNDER_CONSTRUCTION": return "Under construction"; case "UPGRADING": return "Upgrading"; case "RELOCATING": return "Relocating"; default: return "Idle"; }
}

export function statusIcon(state: BuildingState): string {
  switch (buildingStatus(state)) { case "Producing": return "⚙"; case "Ready": return "✓"; case "Needs supply": return "!"; case "Under construction": return "◆"; case "Upgrading": return "↑"; case "Relocating": return "↔"; default: return "○"; }
}
