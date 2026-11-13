export function nextSupplyStreak(previous: string | null, streakDays: number, now: Date): number {
  const day = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (previous === day) return streakDays;
  return previous === yesterday ? streakDays + 1 : 1;
}
