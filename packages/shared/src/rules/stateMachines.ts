export const BUILDING_STATES = [
  "UNDER_CONSTRUCTION",
  "ACTIVE",
  "NEEDS_SUPPLY",
  "PRODUCING",
  "READY_TO_COLLECT",
  "UPGRADING",
  "RELOCATING",
] as const;

export type BuildingState = (typeof BUILDING_STATES)[number];

export const BUILDING_TRANSITIONS: { readonly [State in BuildingState]: readonly BuildingState[] } = {
  UNDER_CONSTRUCTION: ["ACTIVE"],
  ACTIVE: ["NEEDS_SUPPLY", "PRODUCING", "READY_TO_COLLECT", "UPGRADING", "RELOCATING"],
  NEEDS_SUPPLY: ["ACTIVE"],
  PRODUCING: ["READY_TO_COLLECT"],
  READY_TO_COLLECT: ["ACTIVE"],
  UPGRADING: ["ACTIVE"],
  RELOCATING: ["ACTIVE"],
};

export const FRANCHISE_STATES = [
  "DRAFT",
  "REQUESTED",
  "ACCEPTED",
  "ACTIVE",
  "PAUSED",
  "TERMINATED",
  "SUPPLIED",
  "EARNING",
  "READY",
  "SETTLED",
] as const;

export type FranchiseState = (typeof FRANCHISE_STATES)[number];

export const FRANCHISE_TRANSITIONS: { readonly [State in FranchiseState]: readonly FranchiseState[] } = {
  DRAFT: ["REQUESTED"],
  REQUESTED: ["ACCEPTED"],
  ACCEPTED: ["ACTIVE"],
  ACTIVE: ["PAUSED", "TERMINATED", "SUPPLIED"],
  PAUSED: ["ACTIVE"],
  TERMINATED: [],
  SUPPLIED: ["EARNING"],
  EARNING: ["READY"],
  READY: ["SETTLED"],
  SETTLED: ["ACTIVE"],
};

export const TRAIN_STATES = ["LOADING", "IN_TRANSIT"] as const;

export type TrainState = (typeof TRAIN_STATES)[number];

export const TRAIN_TRANSITIONS: { readonly [State in TrainState]: readonly TrainState[] } = {
  LOADING: ["IN_TRANSIT"],
  IN_TRANSIT: ["LOADING"],
};

export class IllegalTransitionError extends Error {
  readonly machine: "building" | "franchise" | "train";
  readonly from: string;
  readonly to: string;

  constructor(machine: "building" | "franchise" | "train", from: string, to: string) {
    super(`illegal ${machine} transition ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
    this.machine = machine;
    this.from = from;
    this.to = to;
  }
}

function move<State extends string>(
  machine: "building" | "franchise" | "train",
  table: { readonly [Key in State]: readonly State[] },
  from: State,
  to: State,
): State {
  const allowed = table[from];
  if (!allowed.some((candidate) => candidate === to)) {
    throw new IllegalTransitionError(machine, from, to);
  }
  return to;
}

export function transitionBuilding(from: BuildingState, to: BuildingState): BuildingState {
  return move("building", BUILDING_TRANSITIONS, from, to);
}

export function transitionFranchise(from: FranchiseState, to: FranchiseState): FranchiseState {
  return move("franchise", FRANCHISE_TRANSITIONS, from, to);
}

export function transitionTrain(from: TrainState, to: TrainState): TrainState {
  return move("train", TRAIN_TRANSITIONS, from, to);
}
