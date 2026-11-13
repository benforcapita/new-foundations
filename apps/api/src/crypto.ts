import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function randomSecret(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function sha256Hex(value: string): string {
  return digest(value).toString("hex");
}

export function sha256Bytes(value: string): Buffer {
  return digest(value);
}

export function hashesEqual(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function digest(value: string): Buffer {
  const pepper = process.env.SESSION_PEPPER;
  return (pepper ? createHmac("sha256", pepper) : createHash("sha256")).update(value).digest();
}
