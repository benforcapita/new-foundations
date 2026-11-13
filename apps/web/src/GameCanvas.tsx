import { useEffect, useRef } from "react";
import { createIsoGame } from "./game/IsoScene";

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = hostRef.current;
    if (parent === null) {
      return;
    }
    const game = createIsoGame(parent);
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={hostRef} className="game-canvas" data-testid="game-canvas" />;
}
