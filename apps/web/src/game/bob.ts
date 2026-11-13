export const BOB_AMPLITUDE_PX = 2;
export const BOB_PERIOD_MS = 1_200;

export function cropBobOffset(elapsedMs: number, ready: boolean, reducedMotion: boolean): number {
  if (!ready || reducedMotion) {
    return 0;
  }
  return Math.sin((elapsedMs / BOB_PERIOD_MS) * Math.PI * 2) * BOB_AMPLITUDE_PX;
}
