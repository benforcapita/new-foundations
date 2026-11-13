import { expansionCost, STARTER_MAP } from "@nf/shared";

type ExpansionInput = {
  readonly chunks: readonly (readonly [number, number])[];
  readonly x: number;
  readonly y: number;
  readonly tutorialComplete: boolean;
  readonly coins: number;
};

type ExpansionPlan =
  | { readonly ok: true; readonly cost: number }
  | { readonly ok: false; readonly code: "TUTORIAL_INCOMPLETE" | "EXPANSION_CAP" | "INVALID_EXPANSION" | "INSUFFICIENT_COINS" };

export function planExpansion(input: ExpansionInput): ExpansionPlan {
  if (!input.tutorialComplete) return { ok: false, code: "TUTORIAL_INCOMPLETE" };
  const count = input.chunks.length - STARTER_MAP.chunks.length;
  if (count >= 1) return { ok: false, code: "EXPANSION_CAP" };
  if (input.x < 0 || input.y < 0 || input.x >= 4 || input.y >= 4 ||
      input.chunks.some(([x, y]) => x === input.x && y === input.y) ||
      !input.chunks.some(([x, y]) => Math.abs(x - input.x) + Math.abs(y - input.y) === 1)) {
    return { ok: false, code: "INVALID_EXPANSION" };
  }
  const cost = expansionCost(Math.max(0, count));
  if (input.coins < cost) return { ok: false, code: "INSUFFICIENT_COINS" };
  return { ok: true, cost };
}
