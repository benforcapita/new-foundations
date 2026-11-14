import type { AgricultureId, BuildingId, QuarterTurns } from "@nf/shared";
import { create } from "zustand";
import { cycleRotation } from "./ghost";
import type { LodMode } from "./lod";

export type GhostTone = "valid" | "blocked" | "idle";

export type GhostReadout = {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly rotation: QuarterTurns;
  readonly flipX: boolean;
  readonly footprint: string;
  readonly tone: GhostTone;
  readonly text: string;
  readonly icon: string;
  readonly roadHint: boolean;
  readonly latencyMs: number;
};

export type OverlayReadout = {
  readonly id: string;
  readonly state: string;
  readonly text: string;
  readonly kind: "full" | "dot";
  readonly label: string;
  readonly labelBox: string;
  readonly iconBox: string;
};

export const IDLE_GHOST: GhostReadout = {
  active: false,
  x: 0,
  y: 0,
  rotation: 0,
  flipX: false,
  footprint: "",
  tone: "idle",
  text: "Idle",
  icon: "",
  roadHint: false,
  latencyMs: 0,
};

type SceneState = {
  readonly photoMode: boolean;
  readonly ready: boolean;
  readonly zoom: number;
  readonly lod: LodMode;
  readonly districtList: boolean;
  readonly reducedMotion: boolean;
  readonly depthOrder: string;
  readonly spriteFrames: string;
  readonly mapSize: string;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly overlays: readonly OverlayReadout[];
  readonly ghost: GhostReadout;
  readonly error: string;
  readonly selectedId: string | null;
  readonly moveId: string | null;
  readonly cropOffset: number;
  readonly aim: { readonly x: number; readonly y: number; readonly zoom: number; readonly nonce: number } | null;
  publish: (patch: Partial<Omit<SceneState, "publish" | "aimAt">>) => void;
  aimAt: (x: number, y: number, zoom: number) => void;
};

export const useSceneStore = create<SceneState>((set) => ({
  photoMode: false,
  ready: false,
  zoom: 1,
  lod: "detailed",
  districtList: false,
  reducedMotion: false,
  depthOrder: "",
  spriteFrames: "[]",
  mapSize: "24x24",
  scrollX: 0,
  scrollY: 0,
  overlays: [],
  ghost: IDLE_GHOST,
  error: "",
  selectedId: null,
  moveId: null,
  cropOffset: 0,
  aim: null,
  publish: (patch) => {
    if (patch.photoMode === true) usePlacementStore.getState().cancel();
    set(patch);
  },
  aimAt: (x, y, zoom) => {
    set((state) => ({ aim: { x, y, zoom, nonce: (state.aim?.nonce ?? 0) + 1 } }));
  },
}));

type PlacementState = {
  readonly catalogId: BuildingId | AgricultureId | null;
  readonly rotation: QuarterTurns;
  select: (catalogId: BuildingId | AgricultureId) => void;
  cancel: () => void;
  rotate: () => void;
};

export const usePlacementStore = create<PlacementState>((set, get) => ({
  catalogId: null,
  rotation: 0,
  select: (catalogId) => {
    set({ catalogId, rotation: 0 });
  },
  cancel: () => {
    set({ catalogId: null, rotation: 0 });
  },
  rotate: () => {
    if (get().catalogId === null) {
      return;
    }
    set({ rotation: cycleRotation(get().rotation) });
  },
}));
