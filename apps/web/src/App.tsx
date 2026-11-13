import { APP_NAME } from "@nf/shared";
import { useEffect } from "react";
import { Feedback } from "./components/Feedback";
import { GameCanvas } from "./GameCanvas";
import { usePlacementStore, useSceneStore } from "./game/scene-store";
import { useShellStore } from "./shell-store";

export function App() {
  const ready = useShellStore((state) => state.ready);
  const markReady = useShellStore((state) => state.markReady);
  const scene = useSceneStore();
  const selectBuilding = usePlacementStore((state) => state.select);
  const cancelPlacement = usePlacementStore((state) => state.cancel);

  useEffect(() => {
    markReady();
  }, [markReady]);

  return (
    <main className="app">
      <header>
        <h1>{APP_NAME}</h1>
        <p>{ready ? "Client ready" : "Starting client"}</p>
      </header>
      <div className="toolbar">
        <button type="button" data-testid="place-cottage" onClick={() => selectBuilding("B-001")}>
          Place Cottage
        </button>
        <button type="button" data-testid="place-station" onClick={() => selectBuilding("B-011")}>
          Place Train Station
        </button>
        <button type="button" data-testid="cancel-placement" onClick={() => cancelPlacement()}>
          Cancel
        </button>
        <form
          className="aim"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            useSceneStore.getState().aimAt(Number(data.get("x")), Number(data.get("y")), Number(data.get("zoom")));
          }}
        >
          <input name="x" data-testid="aim-x" aria-label="Aim x" defaultValue="0" />
          <input name="y" data-testid="aim-y" aria-label="Aim y" defaultValue="0" />
          <input name="zoom" data-testid="aim-zoom" aria-label="Aim zoom" defaultValue="1" />
          <button type="submit" data-testid="aim-go">
            Aim
          </button>
        </form>
        {scene.districtList ? (
          <button type="button" data-testid="district-list-hook">
            District Building List
          </button>
        ) : null}
      </div>
      <GameCanvas />
      <Feedback />
      <section className="readout" data-testid="scene-readout" aria-live="polite">
        <span data-testid="scene-ready">{scene.ready ? "yes" : "no"}</span>
        <span data-testid="map-size">{scene.mapSize}</span>
        <span data-testid="depth-order">{scene.depthOrder}</span>
        <span data-testid="sprite-frames">{scene.spriteFrames}</span>
        <span data-testid="lod-mode">{scene.lod}</span>
        <span data-testid="zoom">{scene.zoom.toFixed(2)}</span>
        <span data-testid="camera-scroll">
          {scene.scrollX},{scene.scrollY}
        </span>
        <span data-testid="reduced-motion">{scene.reducedMotion ? "reduce" : "no-preference"}</span>
        <span data-testid="crop-offset">{scene.cropOffset}</span>
        <span data-testid="ghost-cell">
          {scene.ghost.x},{scene.ghost.y}
        </span>
        <span data-testid="ghost-tone">{scene.ghost.tone}</span>
        <span data-testid="ghost-text">{scene.ghost.text}</span>
        <span data-testid="ghost-icon">{scene.ghost.icon}</span>
        <span data-testid="ghost-road-hint">{scene.ghost.roadHint ? "yes" : "no"}</span>
        <span data-testid="ghost-rotation">{scene.ghost.rotation}</span>
        <span data-testid="ghost-flip">{scene.ghost.flipX ? "true" : "false"}</span>
        <span data-testid="ghost-footprint">{scene.ghost.footprint}</span>
        <span data-testid="ghost-latency">{scene.ghost.latencyMs}</span>
        {scene.error === "" ? null : <span data-testid="scene-error">{scene.error}</span>}
      </section>
      <ul className="statuses" id="building-statuses" data-testid="building-statuses">
        {scene.overlays.map((overlay) => (
          <li
            key={overlay.id}
            data-testid={`overlay-${overlay.id}`}
            data-kind={overlay.kind}
            data-label={overlay.label}
            data-label-box={overlay.labelBox}
            data-icon-box={overlay.iconBox}
          >
            {overlay.kind === "dot" ? "●" : overlay.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
