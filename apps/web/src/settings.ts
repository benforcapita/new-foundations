import { create } from "zustand";

export type CollectPriority = "QUEST_FIRST" | "OLDEST_FIRST";
export type Settings = { readonly reducedMotion: boolean; readonly musicMuted: boolean; readonly sfxMuted: boolean; readonly collectPriority: CollectPriority };
export const SETTINGS_KEY = "nf.settings";
export const defaultSettings: Settings = { reducedMotion: false, musicMuted: false, sfxMuted: false, collectPriority: "QUEST_FIRST" };
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function readSettings(storage: StorageLike, snapshotPriority: CollectPriority = "QUEST_FIRST"): Settings {
  try {
    const value: unknown = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null");
    if (typeof value !== "object" || value === null) return { ...defaultSettings, collectPriority: snapshotPriority };
    const data = value as Partial<Record<keyof Settings, unknown>>;
    const priority = data.collectPriority;
    return { reducedMotion: data.reducedMotion === true, musicMuted: data.musicMuted === true, sfxMuted: data.sfxMuted === true, collectPriority: priority === "QUEST_FIRST" || priority === "OLDEST_FIRST" ? priority : snapshotPriority };
  } catch { return { ...defaultSettings, collectPriority: snapshotPriority }; }
}
export function saveSettings(storage: StorageLike, settings: Omit<Settings, "collectPriority"> & Partial<Pick<Settings, "collectPriority">>): void { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
type SettingsStore = Settings & { toggle: (key: "reducedMotion" | "musicMuted" | "sfxMuted") => void; setPriority: (value: CollectPriority) => void };
export function storedPriority(storage: StorageLike): CollectPriority | undefined {
  try { const value: unknown = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null"); const priority = (value as { collectPriority?: unknown } | null)?.collectPriority; return priority === "QUEST_FIRST" || priority === "OLDEST_FIRST" ? priority : undefined; } catch { return undefined; }
}
const initial = typeof window === "undefined" ? defaultSettings : readSettings(window.localStorage);
export const useSettings = create<SettingsStore>((set) => ({ ...initial, toggle: (key) => set((state) => {
  const settings = { reducedMotion: state.reducedMotion, musicMuted: state.musicMuted, sfxMuted: state.sfxMuted, [key]: !state[key] };
  if (typeof window !== "undefined") { const priority = storedPriority(window.localStorage); saveSettings(window.localStorage, { ...settings, ...(priority ? { collectPriority: priority } : {}) }); }
  return settings;
}), setPriority: (collectPriority) => set((state) => {
  const settings = { reducedMotion: state.reducedMotion, musicMuted: state.musicMuted, sfxMuted: state.sfxMuted, collectPriority };
  if (typeof window !== "undefined") saveSettings(window.localStorage, settings);
  return settings;
}) }));
