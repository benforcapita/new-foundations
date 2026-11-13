import { expect, test } from "vitest";
import type { PlaceResult } from "@nf/shared";
import { cycleRotation, ghostFeedback, nearestRoadCell, spriteFlipX } from "./ghost";

function result(patch: Partial<PlaceResult> = {}): PlaceResult {
  return { ok: true, reasons: [], roadHint: false, ...patch };
}

test("valid ghosts are green with an icon and text, blocked ghosts name the reason", () => {
  const valid = ghostFeedback(result({ roadHint: true }));
  expect(valid.tone).toBe("valid");
  expect(valid.tint).toBe(0x7dffb3);
  expect(valid.icon).toBe("ico_ui_check");
  expect(valid.text).toBe("Valid");
  expect(valid.roadHint).toBe(true);

  const blocked = ghostFeedback(
    result({ ok: false, reasons: ["BAD_TERRAIN", "OCCUPIED"], roadHint: false }),
  );
  expect(blocked.tone).toBe("blocked");
  expect(blocked.tint).toBe(0xff6b6b);
  expect(blocked.icon).toBe("ico_ui_alert");
  expect(blocked.text).toBe("BAD_TERRAIN, OCCUPIED");
  expect(blocked.roadHint).toBe(false);
});

test("R cycles quarter turns and odd turns flip the sprite while swapping the footprint", () => {
  expect(cycleRotation(0)).toBe(1);
  expect(cycleRotation(1)).toBe(2);
  expect(cycleRotation(2)).toBe(3);
  expect(cycleRotation(3)).toBe(0);
  expect(spriteFlipX(0)).toBe(false);
  expect(spriteFlipX(1)).toBe(true);
  expect(spriteFlipX(2)).toBe(false);
  expect(spriteFlipX(3)).toBe(true);
});

test("the road hint targets the nearest road cell", () => {
  expect(
    nearestRoadCell({ x: 0, y: 18, width: 2, height: 2 }, [
      { x: 8, y: 8 },
      { x: 0, y: 8 },
      { x: 16, y: 8 },
    ]),
  ).toEqual({ x: 0, y: 8 });
  expect(nearestRoadCell({ x: 0, y: 0, width: 1, height: 1 }, [])).toBeNull();
});
