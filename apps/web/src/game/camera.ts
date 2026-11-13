export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 2;
export const PAN_STEP = 48;

export type CameraAction =
  | { readonly type: "rotate" }
  | { readonly type: "cancel" }
  | { readonly type: "pan"; readonly x: number; readonly y: number };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomFromWheel(current: number, deltaY: number): number {
  if (deltaY === 0) {
    return clampZoom(current);
  }
  const factor = deltaY > 0 ? 0.9 : 1.1;
  return clampZoom(current * factor);
}

export function zoomFromPinch(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) {
    return clampZoom(startZoom);
  }
  return clampZoom(startZoom * (distance / startDistance));
}

export function cameraAction(key: string): CameraAction | null {
  switch (key) {
    case "r":
    case "R":
      return { type: "rotate" };
    case "Escape":
      return { type: "cancel" };
    case "ArrowLeft":
    case "a":
    case "A":
      return { type: "pan", x: -PAN_STEP, y: 0 };
    case "ArrowRight":
    case "d":
    case "D":
      return { type: "pan", x: PAN_STEP, y: 0 };
    case "ArrowUp":
    case "w":
    case "W":
      return { type: "pan", x: 0, y: -PAN_STEP };
    case "ArrowDown":
    case "s":
    case "S":
      return { type: "pan", x: 0, y: PAN_STEP };
    default:
      return null;
  }
}
