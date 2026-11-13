import type { BuildingState } from "@nf/shared";
import type { LodMode } from "./lod";

export type OverlayIcon = "ico_ui_build" | "ico_ui_alert" | "ico_ui_check";

export type OverlaySpec = {
  readonly marker: "construction" | "alert" | "ready" | "timer";
  readonly icon: OverlayIcon | null;
  readonly text: string;
};

export type OverlayView = {
  readonly kind: "full" | "dot";
  readonly icon: OverlayIcon | null;
  readonly text: string;
};

export function overlayForState(state: BuildingState, timerLabel: string): OverlaySpec | null {
  switch (state) {
    case "UNDER_CONSTRUCTION":
      return { marker: "construction", icon: "ico_ui_build", text: "Under Construction" };
    case "NEEDS_SUPPLY":
      return { marker: "alert", icon: "ico_ui_alert", text: "Needs Supply" };
    case "READY_TO_COLLECT":
      return { marker: "ready", icon: "ico_ui_check", text: "Ready" };
    case "PRODUCING":
      return { marker: "timer", icon: null, text: timerLabel };
    case "ACTIVE":
    case "UPGRADING":
    case "RELOCATING":
      return null;
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

export function overlayLod(overlay: OverlaySpec, mode: LodMode): OverlayView {
  if (mode === "collapsed") {
    return { kind: "dot", icon: overlay.icon, text: "" };
  }
  return { kind: "full", icon: overlay.icon, text: overlay.text };
}
