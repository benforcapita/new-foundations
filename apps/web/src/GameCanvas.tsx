import { useEffect, useRef, useState } from "react";
import { gridToScreen } from "@nf/shared";
import { useCityStore, visibleSnapshot } from "./api/store";
import { tutorialStep, tutorialTarget } from "./components/tutorialStep";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "./game/layout";
import { useSceneStore } from "./game/scene-store";
import { createIsoGame } from "./game/IsoScene";

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const state = useCityStore();
  const snapshot = visibleSnapshot(state);
  const scene = useSceneStore();
  const step = snapshot && tutorialStep(snapshot);
  const target = snapshot ? tutorialTarget(snapshot, step) : undefined;
  const point = target && gridToScreen(target.x + 0.5, target.y + 0.5, MAP_ORIGIN_X, MAP_ORIGIN_Y);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setSize({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const parent = hostRef.current;
    if (parent === null) {
      return;
    }
    const game = createIsoGame(parent);
    const exportPhoto = () => {
      const camera = game.scene.scenes[0]?.cameras.main;
      if (!camera) return;
      const canvas = game.canvas, width = canvas.width, height = canvas.height;
      const zoom = camera.zoom, centerX = camera.midPoint.x, centerY = camera.midPoint.y;
      canvas.width = width * 2; canvas.height = height * 2;
      game.renderer.resize(canvas.width, canvas.height); camera.setViewport(0, 0, canvas.width, canvas.height);
      camera.setZoom(zoom * 2); camera.centerOn(centerX, centerY);
      game.renderer.snapshot((image) => {
        canvas.width = width; canvas.height = height; game.renderer.resize(width, height);
        camera.setViewport(0, 0, width, height); camera.setZoom(zoom); camera.centerOn(centerX, centerY);
        if (!(image instanceof HTMLImageElement)) return;
        const link = document.createElement("a"); link.href = image.src;
        link.download = `new-foundations-${new Date().toISOString().slice(0, 10)}.png`; link.click();
      });
    };
    window.addEventListener("nf-photo-export", exportPhoto);
    return () => {
      window.removeEventListener("nf-photo-export", exportPhoto);
      game.destroy(true);
    };
  }, []);

  return <div ref={hostRef} className="game-canvas" data-testid="game-canvas">{point && !scene.photoMode && <div data-testid="tutorial-target" className="tutorial-target" style={{ left: (point.x - scene.scrollX - size.width / 2) * scene.zoom + size.width / 2, top: (point.y - scene.scrollY - size.height / 2) * scene.zoom + size.height / 2 }} />}</div>;
}
