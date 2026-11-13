import { expect, test } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, cameraAction, clampZoom, screenFromWorld, worldFromScreen, zoomFromPinch, zoomFromWheel } from "./camera";

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

test("zoom stays centered on the view instead of the top-left corner", () => {
  const width = 800;
  const height = 600;
  const center = { x: 1526, y: 204 };
  const scrollX = center.x - width / 2;
  const scrollY = center.y - height / 2;
  expect(screenFromWorld(center.x, center.y, scrollX, scrollY, 2, width, height)).toEqual({
    x: width / 2,
    y: height / 2,
  });
  expect(screenFromWorld(center.x + 10, center.y, scrollX, scrollY, 2, width, height).x).toBe(width / 2 + 20);
  const screen = screenFromWorld(center.x + 4, center.y - 3, scrollX, scrollY, 1.5, width, height);
  expect(worldFromScreen(screen.x, screen.y, scrollX, scrollY, 1.5, width, height)).toEqual({
    x: center.x + 4,
    y: center.y - 3,
  });
});

test("arrows and WASD pan, R rotates, and Esc cancels", () => {
  expect(cameraAction({ key: "ArrowLeft" })).toEqual({ type: "pan", x: -48, y: 0 });
  expect(cameraAction({ key: "d" })).toEqual({ type: "pan", x: 48, y: 0 });
  expect(cameraAction({ key: "W" })).toEqual({ type: "pan", x: 0, y: -48 });
  expect(cameraAction({ key: "s" })).toEqual({ type: "pan", x: 0, y: 48 });
  expect(cameraAction({ key: "r" })).toEqual({ type: "rotate" });
  expect(cameraAction({ key: "R" })).toEqual({ type: "rotate" });
  expect(cameraAction({ key: "Escape" })).toEqual({ type: "cancel" });
  expect(cameraAction({ key: "c" })).toBeNull();
  expect(cameraAction({ key: "r", ctrlKey: true })).toBeNull();
  expect(cameraAction({ key: "r", metaKey: true })).toBeNull();
  expect(cameraAction({ key: "R", altKey: true })).toBeNull();
});
