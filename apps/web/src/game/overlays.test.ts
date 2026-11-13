import { expect, test } from "vitest";
import { overlayForState, overlayLod } from "./overlays";

test("building states map to icon and text overlays", () => {
  expect(overlayForState("UNDER_CONSTRUCTION", "3:00")).toEqual({
    marker: "construction",
    icon: "ico_ui_build",
    text: "Under Construction",
  });
  expect(overlayForState("NEEDS_SUPPLY", "3:00")).toEqual({
    marker: "alert",
    icon: "ico_ui_alert",
    text: "Needs Supply",
  });
  expect(overlayForState("READY_TO_COLLECT", "3:00")).toEqual({
    marker: "ready",
    icon: "ico_ui_check",
    text: "Ready",
  });
  expect(overlayForState("PRODUCING", "3:00")).toEqual({
    marker: "timer",
    icon: null,
    text: "3:00",
  });
  expect(overlayForState("ACTIVE", "3:00")).toBeNull();
  expect(overlayForState("UPGRADING", "3:00")).toBeNull();
  expect(overlayForState("RELOCATING", "3:00")).toBeNull();
});

test("collapsed LOD keeps a status dot and hides the long label", () => {
  const overlay = overlayForState("NEEDS_SUPPLY", "3:00");
  expect(overlay).not.toBeNull();
  if (overlay === null) {
    return;
  }
  expect(overlayLod(overlay, "detailed")).toEqual({ kind: "full", icon: "ico_ui_alert", text: "Needs Supply" });
  expect(overlayLod(overlay, "collapsed")).toEqual({ kind: "dot", icon: "ico_ui_alert", text: "" });
});
