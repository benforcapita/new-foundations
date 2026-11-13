import { LEVELS, levelForXp } from "@nf/shared";

export type LedgerWrite = {
  readonly resource: string;
  readonly delta: number;
  readonly source: string;
  readonly refType?: string;
  readonly refId?: string;
};

/** Placement XP is 1 for a free building and otherwise one tenth of the coins actually charged. */
export function placementXp(coinsCharged: number): number {
  if (!Number.isInteger(coinsCharged) || coinsCharged < 0) {
    throw new Error("coins charged must be a non-negative integer");
  }
  return Math.max(1, Math.round(coinsCharged / 10));
}

export function levelRewardEntries(beforeXp: number, afterXp: number): LedgerWrite[] {
  const before = levelForXp(beforeXp);
  const after = levelForXp(afterXp);
  const entries: LedgerWrite[] = [];
  for (let level = before + 1; level <= after; level += 1) {
    const reward = LEVELS.find((entry) => entry.level === level)?.reward;
    if (reward === undefined) {
      continue;
    }
    if (reward.coins > 0) {
      entries.push({ resource: "COINS", delta: reward.coins, source: "level_reward" });
    }
    if (reward.civicStars > 0) {
      entries.push({ resource: "CIVIC_STARS", delta: reward.civicStars, source: "level_reward" });
    }
  }
  return entries;
}
