import { isUuid } from "../crypto";
import { ApiError } from "../errors";

export function readIdempotencyKey(header: string | string[] | undefined): string {
  if (header === undefined || header === "") {
    throw new ApiError(400, "VALIDATION", "Idempotency-Key header is required");
  }
  if (Array.isArray(header) || !isUuid(header)) {
    throw new ApiError(400, "VALIDATION", "Idempotency-Key must be a UUID");
  }
  return header;
}

export function readCityVersion(header: string | string[] | undefined): number | null {
  if (header === undefined || header === "") {
    return null;
  }
  if (Array.isArray(header) || !/^\d+$/.test(header)) {
    throw new ApiError(400, "VALIDATION", "X-City-Version must be a nonnegative integer");
  }
  return Number(header);
}

export function readContentVersion(header: string | string[] | undefined): number | null {
  if (header === undefined || header === "") {
    return null;
  }
  if (Array.isArray(header) || !/^\d+$/.test(header)) {
    throw new ApiError(400, "VALIDATION", "X-Content-Version must be a nonnegative integer");
  }
  return Number(header);
}
