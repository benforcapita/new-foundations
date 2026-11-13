import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "@nf/shared/schemas";
import { api, ApiError } from "./client";
import { useCityStore } from "./store";

const snapshot = { cityVersion: 1, buildings: [] } as unknown as Snapshot;
const session = { token: "token", cityId: "city", userId: "user", isNew: false };
const first = { key: "00000000-0000-4000-8000-000000000001", name: "place-building" as const, body: { definitionId: "B-001" as const, x: 1, y: 2, rotation: 0 as const } };
const second = { ...first, key: "00000000-0000-4000-8000-000000000002", body: { ...first.body, x: 3 } };
function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("localStorage", storage());
  useCityStore.setState({ session, snapshot, queue: [], error: "", flushing: false });
});
describe("sync queue", () => {
  it("rolls back a rejected command and refreshes the snapshot", async () => {
    const fresh = { ...snapshot, cityVersion: 2 };
    vi.spyOn(api, "command").mockRejectedValue(new ApiError(409, "conflict"));
    vi.spyOn(api, "snapshot").mockResolvedValue(fresh);
    useCityStore.setState({ queue: [first] });
    await useCityStore.getState().flush();
    expect(useCityStore.getState()).toMatchObject({ snapshot: fresh, queue: [], error: expect.stringContaining("conflict") });
    expect(JSON.parse(localStorage.getItem("nf_pending_queue:city") ?? "null")).toEqual([]);
  });
  it("persists pending commands and retries in order with the original keys", async () => {
    const command = vi.spyOn(api, "command").mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue({} as never);
    vi.spyOn(api, "snapshot").mockResolvedValue(snapshot);
    useCityStore.getState().enqueue(first);
    await vi.waitFor(() => expect(useCityStore.getState().flushing).toBe(false));
    expect(JSON.parse(localStorage.getItem("nf_pending_queue:city") ?? "null")).toEqual([first]);
    useCityStore.setState({ queue: [first, second] });
    await useCityStore.getState().flush();
    expect(command.mock.calls.map((call) => call[4])).toEqual([first.key, first.key, second.key]);
    expect(useCityStore.getState().queue).toEqual([]);
  });
});
