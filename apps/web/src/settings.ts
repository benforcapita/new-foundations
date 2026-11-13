import { create } from "zustand";

export type Settings = { readonly reducedMotion: boolean; readonly musicMuted: boolean; readonly sfxMuted: boolean };
export const SETTINGS_KEY = "nf.settings";
export const defaultSettings: Settings = { reducedMotion: false, musicMuted: false, sfxMuted: false };
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function readSettings(storage: StorageLike): Settings {
  try {
    const value: unknown = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null");
    if (typeof value !== "object" || value === null) return defaultSettings;
    const data = value as Partial<Record<keyof Settings, unknown>>;
    return { reducedMotion: data.reducedMotion === true, musicMuted: data.musicMuted === true, sfxMuted: data.sfxMuted === true };
  } catch { return defaultSettings; }
}
export function saveSettings(storage: StorageLike, settings: Settings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
type SettingsStore = Settings & { toggle: (key: keyof Settings) => void };
const initial = typeof window === "undefined" ? defaultSettings : readSettings(window.localStorage);
export const useSettings = create<SettingsStore>((set) => ({ ...initial, toggle: (key) => set((state) => {
  const settings = { reducedMotion: state.reducedMotion, musicMuted: state.musicMuted, sfxMuted: state.sfxMuted, [key]: !state[key] };
  if (typeof window !== "undefined") saveSettings(window.localStorage, settings);
  return settings;
}) }));
