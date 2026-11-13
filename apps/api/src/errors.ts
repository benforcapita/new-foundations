export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;
  readonly cityVersion: number | undefined;
  readonly delta: unknown;

  constructor(
    statusCode: number,
    code: string,
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

export function apiErrorBody(error: ApiError): Record<string, unknown> {
  const inner: Record<string, unknown> = { code: error.code, message: error.message };
  if (error.details !== undefined) {
    inner.details = error.details;
  }
  const body: Record<string, unknown> = { error: inner };
  if (error.delta !== undefined) {
    body.delta = error.delta;
  }
  if (error.cityVersion !== undefined) {
    body.cityVersion = error.cityVersion;
  }
  return body;
}
