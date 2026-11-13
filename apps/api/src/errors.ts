import { apiErrorSchema, type ErrorCode } from "@nf/shared/schemas";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: unknown;
  readonly cityVersion: number | undefined;
  readonly delta: unknown;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    extras?: { readonly details?: unknown; readonly cityVersion?: number; readonly delta?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = extras?.details;
    this.cityVersion = extras?.cityVersion;
    this.delta = extras?.delta;
  }
}

export function apiErrorBody(error: ApiError): { error: { code: ErrorCode; message: string; details?: unknown }; cityVersion: number } {
  return apiErrorSchema.parse({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    ...(error.delta !== undefined ? { delta: error.delta } : {}),
    cityVersion: error.cityVersion ?? 0,
  });
}
