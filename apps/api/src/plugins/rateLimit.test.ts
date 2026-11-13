import { expect, test } from "vitest";
import { createRateLimiter } from "./rateLimit";

test("rate limiter allows a burst and then the per-minute ceiling", () => {
  let now = 1_000;
  const limiter = createRateLimiter({ now: () => now, burst: 2, perMinute: 3 });
  expect(limiter.consume("session").ok).toBe(true);
  expect(limiter.consume("session").burstRemaining).toBe(0);
  const blocked = limiter.consume("session");
  expect(blocked.ok).toBe(false);
  expect(blocked.retryAfterSeconds).toBe(1);

  now += 1_000;
  expect(limiter.consume("session").ok).toBe(true);
  const minute = limiter.consume("session");
  expect(minute.ok).toBe(false);
  expect(minute.remaining).toBe(0);
});
