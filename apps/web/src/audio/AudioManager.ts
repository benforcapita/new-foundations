export const AUDIO_VISUAL: Readonly<Record<string, string>> = {
  sfx_placement: "Building placed",
  sfx_collect: "Coins collected",
  sfx_supply: "Goods supplied",
  sfx_success: "Action succeeded",
  sfx_error: "Action failed",
  sfx_train_depart: "Train departing",
  sfx_train_arrive: "Train arrived",
  sfx_panel: "Panel opened",
  music_day: "Day music started",
  music_evening: "Evening music started",
};

export function visualForAudio(id: string): string {
  return AUDIO_VISUAL[id] ?? id.replaceAll("_", " ");
}

export interface AudioManager {
  play(id: string): void;
  setMusic(id: string): void;
  setSfxMuted(muted: boolean): void;
  setMusicMuted(muted: boolean): void;
}

export class NoopAudioManager implements AudioManager {
  constructor(private readonly visual: (message: string) => void) {}

  play(id: string): void {
    this.visual(visualForAudio(id));
  }

  setMusic(id: string): void {
    this.visual(visualForAudio(id));
  }

  setSfxMuted(): void {}

  setMusicMuted(): void {}
}
