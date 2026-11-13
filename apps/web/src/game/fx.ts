export type Cue =
  | "collect"
  | "xp"
  | "placement-pop"
  | "sold-out"
  | "train-smoke"
  | "levelup"
  | "franchise-bond"
  | "water-shimmer";

export const cues: Readonly<Record<Cue, { readonly duration: number; readonly toast: string; readonly audioId: string }>> = {
  collect: { duration: 400, toast: "Coins collected", audioId: "sfx_collect" },
  xp: { duration: 400, toast: "XP gained", audioId: "sfx_success" },
  "placement-pop": { duration: 180, toast: "+5 Residents", audioId: "sfx_placement" },
  "sold-out": { duration: 600, toast: "Needs Supply", audioId: "sfx_error" },
  "train-smoke": { duration: 600, toast: "Train departing", audioId: "sfx_train_depart" },
  levelup: { duration: 2000, toast: "Level up!", audioId: "sfx_success" },
  "franchise-bond": { duration: 600, toast: "Franchise connected", audioId: "sfx_panel" },
  "water-shimmer": { duration: 3000, toast: "Water", audioId: "sfx_panel" },
};

export function runCue(
  cue: Cue,
  reducedMotion: boolean,
  start: (duration: number) => void,
  toast: (message: string) => void,
): void {
  toast(cues[cue].toast);
  if (!reducedMotion) {
    start(cues[cue].duration);
  }
}

export function scheduleDismiss(dismiss: () => void): ReturnType<typeof setTimeout> {
  return setTimeout(dismiss, cues.levelup.duration);
}
