import { expect, test } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, cameraAction, clampZoom, zoomFromPinch, zoomFromWheel } from "./camera";

test("zoom stays inside 0.65 and 2", () => {
  expect(MIN_ZOOM).toBe(0.65);
  expect(MAX_ZOOM).toBe(2);
  expect(clampZoom(0.2)).toBe(0.65);
  expect(clampZoom(3)).toBe(2);
  expect(clampZoom(1)).toBe(1);
  expect(zoomFromWheel(1, 120)).toBeCloseTo(0.9);
  expect(zoomFromWheel(0.9, 120)).toBeCloseTo(0.81);
  expect(zoomFromWheel(1, -120)).toBeCloseTo(1.1);
  expect(zoomFromWheel(2, -120)).toBe(2);
  expect(zoomFromWheel(0.65, 120)).toBe(0.65);
  expect(zoomFromPinch(1, 100, 50)).toBe(0.65);
  expect(zoomFromPinch(1, 100, 180)).toBeCloseTo(1.8);
  expect(zoomFromPinch(1, 0, 40)).toBe(1);
});

test("arrows and WASD pan, R rotates, and Esc cancels", () => {
  expect(cameraAction("ArrowLeft")).toEqual({ type: "pan", x: -48, y: 0 });
  expect(cameraAction("d")).toEqual({ type: "pan", x: 48, y: 0 });
  expect(cameraAction("W")).toEqual({ type: "pan", x: 0, y: -48 });
  expect(cameraAction("s")).toEqual({ type: "pan", x: 0, y: 48 });
  expect(cameraAction("r")).toEqual({ type: "rotate" });
  expect(cameraAction("R")).toEqual({ type: "rotate" });
  expect(cameraAction("Escape")).toEqual({ type: "cancel" });
  expect(cameraAction("c")).toBeNull();
});
