import Phaser from "phaser";
import { useEffect, useRef } from "react";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  public create(): void {
    this.add.text(16, 16, "New Foundations", {
      color: "#f4f1ea",
      fontFamily: "sans-serif",
      fontSize: "20px",
    });
  }
}

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = hostRef.current;
    if (parent === null) {
      return;
    }

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent,
      width: 480,
      height: 270,
      backgroundColor: "#1b1f2a",
      banner: false,
      audio: { noAudio: true },
      scene: [BootScene],
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={hostRef} data-testid="game-canvas" />;
}
