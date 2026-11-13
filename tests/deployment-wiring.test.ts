import { createHash, createHmac } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { sha256Bytes, sha256Hex } from "../apps/api/src/crypto";

const previous = process.env.SESSION_PEPPER;
afterEach(() => {
  if (previous === undefined) delete process.env.SESSION_PEPPER;
  else process.env.SESSION_PEPPER = previous;
});

test("hashing retains SHA-256 without a pepper and uses HMAC when configured", () => {
  delete process.env.SESSION_PEPPER;
  expect(sha256Hex("sample")).toBe(createHash("sha256").update("sample").digest("hex"));
  process.env.SESSION_PEPPER = "test-pepper";
  const expected = createHmac("sha256", "test-pepper").update("sample").digest("hex");
  expect(sha256Hex("sample")).toBe(expected);
  expect(sha256Bytes("sample").toString("hex")).toBe(expected);
});
