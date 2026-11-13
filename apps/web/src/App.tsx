import { APP_NAME } from "@nf/shared";
import { useEffect } from "react";
import { GameCanvas } from "./GameCanvas";
import { useShellStore } from "./shell-store";

export function App() {
  const ready = useShellStore((state) => state.ready);
  const markReady = useShellStore((state) => state.markReady);

  useEffect(() => {
    markReady();
  }, [markReady]);

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>{ready ? "Client ready" : "Starting client"}</p>
      <GameCanvas />
    </main>
  );
}
