import type { BuildingId, QuarterTurns } from "@nf/shared";
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
  readonly ready: boolean;
  readonly zoom: number;
  readonly lod: LodMode;
  readonly districtList: boolean;
  readonly reducedMotion: boolean;
  readonly depthOrder: string;
  readonly mapSize: string;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly overlays: readonly OverlayReadout[];
  readonly ghost: GhostReadout;
  readonly error: string;
  publish: (patch: Partial<Omit<SceneState, "publish">>) => void;
};

export const useSceneStore = create<SceneState>((set) => ({
  ready: false,
  zoom: 1,
  lod: "detailed",
  districtList: false,
  reducedMotion: false,
  depthOrder: "",
  mapSize: "24x24",
  scrollX: 0,
  scrollY: 0,
  overlays: [],
  ghost: IDLE_GHOST,
  error: "",
  publish: (patch) => {
    set(patch);
  },
}));

type PlacementState = {
  readonly catalogId: BuildingId | null;
  readonly rotation: QuarterTurns;
  select: (catalogId: BuildingId) => void;
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
