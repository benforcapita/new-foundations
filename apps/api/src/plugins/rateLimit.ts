export const COMMAND_BURST = 20;
export const COMMANDS_PER_MINUTE = 600;

export type RateLimitDecision = {
  readonly ok: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly burst: number;
  readonly burstRemaining: number;
  readonly retryAfterSeconds: number;
};

type Bucket = {
  secondStart: number;
  secondCount: number;
  minuteStart: number;
  minuteCount: number;
};

export type RateLimiter = {
  consume(key: string): RateLimitDecision;
};

export function createRateLimiter(options?: {
  readonly now?: () => number;
  readonly burst?: number;
  readonly perMinute?: number;
}): RateLimiter {
  const now = options?.now ?? Date.now;
  const burst = options?.burst ?? COMMAND_BURST;
  const perMinute = options?.perMinute ?? COMMANDS_PER_MINUTE;
  const buckets = new Map<string, Bucket>();

  return {
    consume(key: string): RateLimitDecision {
      const timestamp = now();
      const bucket = buckets.get(key) ?? {
        secondStart: timestamp,
        secondCount: 0,
        minuteStart: timestamp,
        minuteCount: 0,
      };
      if (timestamp - bucket.secondStart >= 1_000) {
        bucket.secondStart = timestamp;
        bucket.secondCount = 0;
      }
      if (timestamp - bucket.minuteStart >= 60_000) {
        bucket.minuteStart = timestamp;
        bucket.minuteCount = 0;
      }
      if (bucket.secondCount >= burst || bucket.minuteCount >= perMinute) {
        buckets.set(key, bucket);
        const retryAfterSeconds =
          bucket.secondCount >= burst ? 1 : Math.max(1, Math.ceil((60_000 - (timestamp - bucket.minuteStart)) / 1_000));
        return {
          ok: false,
          limit: perMinute,
          remaining: Math.max(0, perMinute - bucket.minuteCount),
          burst,
          burstRemaining: Math.max(0, burst - bucket.secondCount),
          retryAfterSeconds,
        };
      }
      bucket.secondCount += 1;
      bucket.minuteCount += 1;
      buckets.set(key, bucket);
      return {
        ok: true,
        limit: perMinute,
        remaining: perMinute - bucket.minuteCount,
        burst,
        burstRemaining: burst - bucket.secondCount,
        retryAfterSeconds: 0,
      };
    },
  };
}
