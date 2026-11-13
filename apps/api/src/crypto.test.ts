import { expect, test } from "vitest";
import { hashesEqual, isUuid, randomSecret, sha256Hex } from "./crypto";

test("session secrets are 32 bytes and hashes compare in constant time", () => {
  const secret = randomSecret();
  expect(secret).toHaveLength(43);
  expect(secret).not.toBe(randomSecret());
  const hash = sha256Hex(secret);
  expect(hash).toHaveLength(64);
  expect(hashesEqual(hash, sha256Hex(secret))).toBe(true);
  expect(hashesEqual(hash, sha256Hex("other"))).toBe(false);
  expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  expect(isUuid("not-a-uuid")).toBe(false);
});
