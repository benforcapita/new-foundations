import { create } from "zustand";

type ShellState = {
  readonly ready: boolean;
  markReady: () => void;
};

export const useShellStore = create<ShellState>((set) => ({
  ready: false,
  markReady: () => {
    set({ ready: true });
  },
}));
