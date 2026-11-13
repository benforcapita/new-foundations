import { useEffect, useRef } from "react";
import type { Snapshot } from "@nf/shared/schemas";
import { gridToScreen } from "@nf/shared";
import { api } from "../api/client";
import { useCityStore } from "../api/store";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../game/layout";
import { usePlacementStore, useSceneStore } from "../game/scene-store";
import { tutorialStep, tutorialTarget } from "./tutorialStep";
import { NpcBadge } from "./NpcBadge";


export function Tutorial({ snapshot }: { snapshot: Snapshot }) {
  const step = tutorialStep(snapshot);
  const focused = useRef<string | null>(null);
  const ready = useSceneStore(s => s.ready);
  const target = tutorialTarget(snapshot, step);
  const x = target?.x; const y = target?.y;
  useEffect(() => {
    if (!step || x === undefined || y === undefined || !ready || focused.current === step) return;
    focused.current = step;
    const point = gridToScreen(x + 0.5, y + 0.5, MAP_ORIGIN_X, MAP_ORIGIN_Y);
    useSceneStore.getState().aimAt(point.x, point.y, 1);
  }, [step, x, y, ready]);
  useEffect(() => {
    if (step !== "coins") return;
    const timer = setInterval(() => {
      const state = useCityStore.getState();
      if (state.session && !state.queue.length) void api.snapshot(state.session.token, state.session.cityId).then(snapshot => useCityStore.setState({ snapshot })).catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);
  if (!step) return null;
  const lines: Record<string, string> = { house: "Welcome! Place a free Cottage on the highlighted plot.", wheat: "Tap the ready Wheat plot and collect three Wheat.", supply: "Select the Grocery and supply it with your three Bread.", coins: "Your Grocery is selling! Collect its coins when ready.", bakery: "Build a Bakery to keep your town growing." };
  return <section className="tutorial" data-testid="tutorial-root"><div data-testid="tutorial-mia"><NpcBadge npc="mia" /></div><div><strong data-testid="tutorial-step">{lines[step]}</strong>{step === "bakery" && <button type="button" data-testid="place-bakery" onClick={() => usePlacementStore.getState().select("B-007")}>Build a Bakery</button>}</div></section>;
}
