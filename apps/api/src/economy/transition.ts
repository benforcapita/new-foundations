import { BUILDING_TRANSITIONS, transitionBuilding, type BuildingState } from "@nf/shared/rules";

const PATHS: Readonly<Record<string, readonly BuildingState[]>> = {
  "UNDER_CONSTRUCTION>ACTIVE": ["ACTIVE"],
  "UNDER_CONSTRUCTION>NEEDS_SUPPLY": ["ACTIVE", "NEEDS_SUPPLY"],
  "ACTIVE>NEEDS_SUPPLY": ["NEEDS_SUPPLY"],
  "ACTIVE>READY_TO_COLLECT": ["READY_TO_COLLECT"],
  "ACTIVE>PRODUCING": ["PRODUCING"],
  "NEEDS_SUPPLY>ACTIVE": ["ACTIVE"],
  "NEEDS_SUPPLY>READY_TO_COLLECT": ["ACTIVE", "READY_TO_COLLECT"],
  "READY_TO_COLLECT>ACTIVE": ["ACTIVE"],
  "READY_TO_COLLECT>NEEDS_SUPPLY": ["ACTIVE", "NEEDS_SUPPLY"],
  "PRODUCING>READY_TO_COLLECT": ["READY_TO_COLLECT"],
  "PRODUCING>ACTIVE": ["READY_TO_COLLECT", "ACTIVE"],
  "PRODUCING>NEEDS_SUPPLY": ["READY_TO_COLLECT", "ACTIVE", "NEEDS_SUPPLY"],
};

export function transitionToward(from: BuildingState, to: BuildingState): BuildingState {
  if (from === to) {
    return from;
  }
  const path = PATHS[`${from}>${to}`];
  if (path === undefined) {
    return transitionBuilding(from, to);
  }
  let current = from;
  for (const step of path) {
    const allowed = BUILDING_TRANSITIONS[current];
    if (!allowed.some((candidate) => candidate === step)) {
      return transitionBuilding(current, step);
    }
    current = transitionBuilding(current, step);
  }
  return current;
}
