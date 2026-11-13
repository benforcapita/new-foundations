import { expect, test } from "vitest";
import {
  BUILDING_STATES,
  BUILDING_TRANSITIONS,
  FRANCHISE_SHIPMENT_STATES,
  FRANCHISE_SHIPMENT_TRANSITIONS,
  FRANCHISE_STATES,
  FRANCHISE_TRANSITIONS,
  IllegalTransitionError,
  TRAIN_STATES,
  TRAIN_TRANSITIONS,
  transitionBuilding,
  transitionFranchise,
  transitionFranchiseShipment,
  transitionTrain,
  type BuildingState,
  type FranchiseShipmentState,
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

test("franchise transitions follow the agreement and shipment states stay separate", () => {
  expect(FRANCHISE_STATES).toEqual(expect.arrayContaining(["DECLINED", "EXPIRED"]));
  expectMachine<FranchiseState>(FRANCHISE_STATES, FRANCHISE_TRANSITIONS, transitionFranchise, "franchise");
  expect(transitionFranchise("ACTIVE", "PAUSED")).toBe("PAUSED");
  expect(transitionFranchise("PAUSED", "ACTIVE")).toBe("ACTIVE");
  expect(transitionFranchise("REQUESTED", "DECLINED")).toBe("DECLINED");
  expect(() => transitionFranchise("TERMINATED", "ACTIVE")).toThrow(IllegalTransitionError);
  expectMachine<FranchiseShipmentState>(
    FRANCHISE_SHIPMENT_STATES,
    FRANCHISE_SHIPMENT_TRANSITIONS,
    transitionFranchiseShipment,
    "shipment",
  );
  expect(() => transitionFranchiseShipment("SETTLED", "SUPPLIED")).toThrow(IllegalTransitionError);
});

test("trains move loading to in transit to arrived and back", () => {
  expect(TRAIN_STATES).toContain("ARRIVED");
  expectMachine<TrainState>(TRAIN_STATES, TRAIN_TRANSITIONS, transitionTrain, "train");
  expect(transitionTrain("IN_TRANSIT", "ARRIVED")).toBe("ARRIVED");
  expect(transitionTrain("ARRIVED", "LOADING")).toBe("LOADING");
});
