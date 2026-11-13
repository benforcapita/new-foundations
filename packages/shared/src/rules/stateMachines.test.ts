import { expect, test } from "vitest";
import {
  BUILDING_STATES,
  BUILDING_TRANSITIONS,
  FRANCHISE_STATES,
  FRANCHISE_TRANSITIONS,
  IllegalTransitionError,
  TRAIN_STATES,
  TRAIN_TRANSITIONS,
  transitionBuilding,
  transitionFranchise,
  transitionTrain,
  type BuildingState,
  type FranchiseState,
  type TrainState,
} from "./stateMachines";

function expectMachine<State extends string>(
  states: readonly State[],
  transitions: { readonly [Key in State]: readonly State[] },
  move: (from: State, to: State) => State,
  machine: string,
): void {
  for (const from of states) {
    for (const to of states) {
      const allowed = transitions[from];
      if (allowed.includes(to)) {
        expect(move(from, to)).toBe(to);
      } else {
        expect(() => move(from, to)).toThrow(IllegalTransitionError);
        try {
          move(from, to);
        } catch (error) {
          expect(error).toMatchObject({ machine, from, to });
        }
      }
    }
  }
}

test("building transitions reject every illegal pair", () => {
  expectMachine<BuildingState>(BUILDING_STATES, BUILDING_TRANSITIONS, transitionBuilding, "building");
});

test("franchise transitions follow the agreement and supply cycle", () => {
  expectMachine<FranchiseState>(FRANCHISE_STATES, FRANCHISE_TRANSITIONS, transitionFranchise, "franchise");
  expect(transitionFranchise("ACTIVE", "PAUSED")).toBe("PAUSED");
  expect(transitionFranchise("PAUSED", "ACTIVE")).toBe("ACTIVE");
  expect(transitionFranchise("SETTLED", "ACTIVE")).toBe("ACTIVE");
  expect(() => transitionFranchise("TERMINATED", "ACTIVE")).toThrow(IllegalTransitionError);
});

test("trains only cycle between loading and in transit", () => {
  expectMachine<TrainState>(TRAIN_STATES, TRAIN_TRANSITIONS, transitionTrain, "train");
});
