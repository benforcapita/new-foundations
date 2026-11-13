import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { AUDIO_VISUAL, NoopAudioManager, visualForAudio, type AudioManager } from "./audio/AudioManager";
import { cues, runCue, scheduleDismiss } from "./game/fx";
import { defaultSettings, readSettings, saveSettings } from "./settings";

afterEach(() => vi.useRealTimers());
test.each([["mia", "Mia", "Civic Engineer", "#2C9D8F"], ["dana", "Dana", "Merchant", "#D98669"], ["tom", "Tom", "Station Manager", "#3B8392"], ["amir", "Amir", "Gardener", "#5A9B79"]] as const)("badge %s provides identity and palette", async (npc, name, role, color) => {
  const path = "./components/NpcBadge.tsx";
  const { NpcBadge } = await import(path);
  const html = renderToStaticMarkup(createElement(NpcBadge, { npc }));
  for (const text of [name, role, color, "NPC", name[0], "#F8EEDB", "#253D4A"]) expect(html).toContain(text);
});
test("settings persist and audio has visual fallback even when muted", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  expect(readSettings(storage)).toEqual(defaultSettings);
  const settings = { reducedMotion: true, musicMuted: true, sfxMuted: true };
  saveSettings(storage, settings);
  expect(readSettings(storage)).toEqual(settings);
  const visual = vi.fn(); const audio: AudioManager = new NoopAudioManager(visual);
  audio.setMusicMuted(true); audio.setSfxMuted(true); audio.play("sfx_collect"); audio.setMusic("music_day");
  expect(visual).toHaveBeenNthCalledWith(1, "Coins collected");
  expect(visual).toHaveBeenNthCalledWith(2, "Day music started");
  expect(visualForAudio("sfx_train_depart")).toBe("Train departing");
  expect(Object.keys(AUDIO_VISUAL).sort()).toEqual([
    "music_day", "music_evening", "sfx_collect", "sfx_error", "sfx_panel", "sfx_placement", "sfx_success", "sfx_supply", "sfx_train_arrive", "sfx_train_depart",
  ]);
});
test("reduced motion skips animation and announces cues; durations are specified", () => {
  const start = vi.fn(); const toast = vi.fn();
  runCue("collect", true, start, toast);
  expect(start).not.toHaveBeenCalled(); expect(toast).toHaveBeenCalledWith("Coins collected");
  runCue("collect", false, start, toast); expect(start).toHaveBeenCalledWith(400);
  expect([cues.xp.duration, cues["placement-pop"].duration, cues["train-smoke"].duration, cues.levelup.duration]).toEqual([400, 180, 600, 2000]);
});
test("level-up dismissal timer can be cancelled", () => {
  vi.useFakeTimers(); const dismiss = vi.fn();
  const timer = scheduleDismiss(dismiss); clearTimeout(timer); vi.advanceTimersByTime(2000); expect(dismiss).not.toHaveBeenCalled();
  scheduleDismiss(dismiss); vi.advanceTimersByTime(2000); expect(dismiss).toHaveBeenCalledOnce();
});
