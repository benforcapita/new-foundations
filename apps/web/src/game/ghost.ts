import type { PlaceReason, PlaceResult, QuarterTurns } from "@nf/shared";

export const GHOST_VALID_TINT = 0x7dffb3;
export const GHOST_BLOCKED_TINT = 0xff6b6b;
export const ROAD_HINT_COLOR = 0xf5d90a;

export type GhostTone = "valid" | "blocked";

export type GhostFeedback = {
  readonly tone: GhostTone;
  readonly tint: number;
  readonly icon: "ico_ui_check" | "ico_ui_alert";
  readonly text: string;
  readonly roadHint: boolean;
  readonly ok: boolean;
  readonly reasons: readonly PlaceResult["reasons"][number][];
};

export function reasonLabel(reason: PlaceReason): string {
  switch (reason) {
    case "OUT_OF_BOUNDS":
      return "Out of bounds";
    case "CHUNK_LOCKED":
      return "Chunk locked";
    case "OCCUPIED":
      return "Occupied";
    case "BAD_TERRAIN":
      return "Bad terrain";
    case "LOCKED_BY_LEVEL":
      return "Locked by level";
    case "INSUFFICIENT_COINS":
      return "Not enough coins";
    case "POP_CAP":
      return "Population cap";
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
}

export function ghostFeedback(result: PlaceResult): GhostFeedback {
  if (result.ok) {
    return {
      tone: "valid",
      tint: GHOST_VALID_TINT,
      icon: "ico_ui_check",
      text: "Valid",
      roadHint: result.roadHint,
      ok: true,
      reasons: [],
    };
  }
  return {
    tone: "blocked",
    tint: GHOST_BLOCKED_TINT,
    icon: "ico_ui_alert",
    text: result.reasons.map(reasonLabel).join(", "),
    roadHint: result.roadHint,
    ok: false,
    reasons: result.reasons,
  };
}

export function cycleRotation(rotation: QuarterTurns): QuarterTurns {
  const next = (rotation + 1) % 4;
  if (next === 0 || next === 1 || next === 2 || next === 3) {
    return next;
  }
  return 0;
}

export function spriteFlipX(rotation: QuarterTurns): boolean {
  return rotation === 1 || rotation === 3;
}

export function nearestRoadCell(
  footprint: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  roads: readonly { readonly x: number; readonly y: number }[],
): { readonly x: number; readonly y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const road of roads) {
    let distance = Number.POSITIVE_INFINITY;
    for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
      for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) {
        distance = Math.min(distance, Math.max(Math.abs(x - road.x), Math.abs(y - road.y)));
      }
    }
    const closer = distance < bestDistance;
    const tie = distance === bestDistance && best !== null && (road.x < best.x || (road.x === best.x && road.y < best.y));
    if (best === null || closer || tie) {
      best = { x: road.x, y: road.y };
      bestDistance = distance;
    }
  }
  return best;
}
