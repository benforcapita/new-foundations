export const APP_NAME = "New Foundations";

export type ServiceName = "api" | "web";

export type HealthReport = {
  readonly ok: true;
  readonly app: typeof APP_NAME;
  readonly service: ServiceName;
};

export function healthReport(service: ServiceName): HealthReport {
  return { ok: true, app: APP_NAME, service };
}
