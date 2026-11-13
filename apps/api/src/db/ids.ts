import { createHash } from "node:crypto";

export function deterministicUuid(key: string): string {
  const hash = createHash("sha256").update(`new-foundations:${key}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  const sixth = bytes[6] ?? 0;
  const eighth = bytes[8] ?? 0;
  bytes[6] = (sixth & 0x0f) | 0x40;
  bytes[8] = (eighth & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
