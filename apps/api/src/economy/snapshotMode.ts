/** Missed versions older than a day, or more than this many versions back, reload the full city. */
export const DELTA_RETENTION_VERSIONS = 100;
export const DELTA_RETENTION_MS = 24 * 60 * 60 * 1000;

export function wantsFullSnapshot(input: {
  readonly sinceVersion: number | null;
  readonly cityVersion: number;
  readonly updatedAtMs: number;
  readonly nowMs: number;
}): boolean {
  if (input.sinceVersion === null || input.sinceVersion <= 0) {
    return true;
  }
  if (input.sinceVersion > input.cityVersion) {
    return true;
  }
  if (input.cityVersion - input.sinceVersion > DELTA_RETENTION_VERSIONS) {
    return true;
  }
  return input.sinceVersion < input.cityVersion && input.nowMs - input.updatedAtMs > DELTA_RETENTION_MS;
}
