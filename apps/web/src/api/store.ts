import { create } from "zustand";
import type { Snapshot } from "@nf/shared/schemas";
import { api, ApiError, type Session } from "./client";
import { bootstrapSession } from "./session";
import { composeSnapshot, type PendingCommand } from "./queue";

type State = {
  session: Session | null; snapshot: Snapshot | null; queue: PendingCommand[]; error: string; flushing: boolean;
  boot: () => Promise<void>; enqueue: (command: PendingCommand) => void; flush: () => Promise<void>;
};
const queueKey = (cityId: string) => `nf_pending_queue:${cityId}`;
function persist(cityId: string, queue: PendingCommand[]) { localStorage.setItem(queueKey(cityId), JSON.stringify(queue)); }
export const useCityStore = create<State>((set, get) => ({
  session: null, snapshot: null, queue: [], error: "", flushing: false,
  boot: async () => {
    try {
      const session = await bootstrapSession();
      const [, snapshot] = await Promise.all([api.catalog(), api.current(session.token)]);
      const queue = JSON.parse(localStorage.getItem(queueKey(session.cityId)) ?? "[]") as PendingCommand[];
      set({ session, snapshot, queue, error: "" });
      void get().flush();
    } catch (error) { set({ error: `Unable to load city: ${String(error)}` }); }
  },
  enqueue: (command) => {
    const { session, queue } = get();
    if (!session) return;
    const next = [...queue, command];
    persist(session.cityId, next); set({ queue: next }); void get().flush();
  },
  flush: async () => {
    const { session, flushing } = get();
    if (!session || flushing) return;
    set({ flushing: true });
    try {
      while (get().queue.length) {
        const command = get().queue[0];
        if (!command) break;
        try {
          await api.command(session.token, session.cityId, command.name, command.body, command.key);
          const snapshot = await api.snapshot(session.token, session.cityId);
          const queue = get().queue.filter((item) => item.key !== command.key);
          persist(session.cityId, queue); set({ snapshot, queue });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status >= 500 || error.status === 429) break;
          const snapshot = await api.snapshot(session.token, session.cityId);
          const queue = get().queue.filter((item) => item.key !== command.key);
          persist(session.cityId, queue); set({ snapshot, queue, error: `Command rejected: ${error.message}` });
        }
      }
    } catch { /* Retain pending commands when the network is unavailable. */ }
    finally { set({ flushing: false }); }
  },
}));
export function visibleSnapshot(state: State): Snapshot | null {
  return state.snapshot ? composeSnapshot(state.snapshot, state.queue) : null;
}
