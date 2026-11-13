import { AGRICULTURE, type AgricultureId } from "@nf/shared";
import { catalogResponseSchema, commandBodySchemas, commandSuccessSchema, deltaSchema, snapshotSchema, type CommandName } from "@nf/shared/schemas";

export type Session = { token: string; userId: string; cityId: string; isNew: boolean; recoveryCode?: string };
export type CommandBody<N extends CommandName> = N extends "place-building" ? Omit<(typeof commandBodySchemas)["place-building"]["_output"], "definitionId"> & { definitionId: (typeof commandBodySchemas)["place-building"]["_output"]["definitionId"] | AgricultureId } : (typeof commandBodySchemas)[N]["_output"];
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const base = import.meta.env.VITE_API_URL ?? "";
async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  const now = (typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("nf_test_now")) ?? (typeof localStorage === "undefined" ? null : localStorage.getItem("nf_test_now"));
  if (now) headers.set("X-Test-Now", now);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const data: unknown = await response.json();
  if (!response.ok) throw new ApiError(response.status, JSON.stringify(data));
  return data;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
export type FranchiseHost = { cityId: string; name: string; npcKey: string; plots: { plotId: string; x: number; y: number }[]; requiredGoods: { goodId: string; qty: number }[]; expectedCycleProfit: number; splitBps: { owner: number; host: number } };
type FranchiseResult = { franchiseId: string; state?: string; cycles?: number; streakDays?: number; ownerAmount?: number; hostAmount?: number; total?: number };
async function franchisePost(token: string, path: string, body: object, key: string): Promise<FranchiseResult> {
  const data = await request(path, { method: "POST", headers: { ...auth(token), "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) });
  return (data as { result: FranchiseResult }).result;
}
export const api = {
  async franchiseHosts(token: string) { return (await request("/v1/franchises/hosts", { headers: auth(token) }) as { hosts: FranchiseHost[] }).hosts; },
  franchiseRequest(token: string, hostCityId: string, plotId: string, key: string) { return franchisePost(token, "/v1/franchises/request", { hostCityId, plotId, businessDefinitionId: "B-004" }, key); },
  franchiseSupply(token: string, id: string, cycles: 1 | 2, key: string) { return franchisePost(token, `/v1/franchises/${encodeURIComponent(id)}/supply`, { cycles }, key); },
  franchiseCollect(token: string, id: string, key: string) { return franchisePost(token, `/v1/franchises/${encodeURIComponent(id)}/collect`, {}, key); },
  async session(body: { token?: string; recoveryCode?: string }): Promise<Session> {
    const data = await request("/v1/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (typeof data !== "object" || data === null || !("token" in data) || typeof data.token !== "string" || !("userId" in data) || typeof data.userId !== "string" || !("cityId" in data) || typeof data.cityId !== "string" || !("isNew" in data) || typeof data.isNew !== "boolean" || ("recoveryCode" in data && typeof data.recoveryCode !== "string")) throw new Error("Invalid session response");
    return data as Session;
  },
  async current(token: string) { return snapshotSchema.parse(await request("/v1/cities/current", { headers: auth(token) })); },
  async snapshot(token: string, cityId: string) { return snapshotSchema.parse(await request(`/v1/cities/${encodeURIComponent(cityId)}/snapshot`, { headers: auth(token) })); },
  async delta(token: string, cityId: string, sinceVersion: number) { return deltaSchema.parse(await request(`/v1/cities/${encodeURIComponent(cityId)}/snapshot?sinceVersion=${sinceVersion}`, { headers: auth(token) })); },
  async catalog() { return catalogResponseSchema.parse(await request("/v1/content/catalog")); },
  async acknowledge(token: string, key: string, body: { type: "acknowledge"; note: string }) {
    return request("/v1/cities/current/commands/acknowledge", { method: "POST", headers: { ...auth(token), "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) });
  },
  async command<N extends CommandName>(token: string, cityId: string, name: N, body: CommandBody<N>, key: string) {
    const validated = name === "place-building" && AGRICULTURE.some((item) => item.id === (body as CommandBody<"place-building">).definitionId)
      ? { ...commandBodySchemas["place-building"].parse({ ...body, definitionId: "B-001" }), definitionId: (body as CommandBody<"place-building">).definitionId }
      : commandBodySchemas[name].parse(body);
    return commandSuccessSchema.parse(await request(`/v1/cities/${encodeURIComponent(cityId)}/commands/${name}`, { method: "POST", headers: { ...auth(token), "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(validated) }));
  },
};
