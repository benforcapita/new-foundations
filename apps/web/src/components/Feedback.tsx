import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NoopAudioManager, type AudioManager } from "../audio/AudioManager";
import { resolveAssetUrl } from "../game/assetUrls";
import { cues, runCue, scheduleDismiss, type Cue } from "../game/fx";
import { useSceneStore } from "../game/scene-store";
import { useSettings } from "../settings";
import { NpcBadge, type Npc } from "./NpcBadge";

const demoCues: readonly Cue[] = [
  "collect",
  "xp",
  "placement-pop",
  "sold-out",
  "train-smoke",
  "franchise-bond",
  "levelup",
];

type Flight = {
  readonly cue: "collect" | "xp";
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly key: number;
};

function centerIn(container: DOMRect, target: Element): { readonly x: number; readonly y: number } {
  const box = target.getBoundingClientRect();
  return { x: box.left + box.width / 2 - container.left, y: box.top + box.height / 2 - container.top };
}

export function Feedback() {
  const settings = useSettings();
  const reduced = useSceneStore((state) => state.reducedMotion);
  const [toast, setToast] = useState("");
  const [active, setActive] = useState<{ readonly cue: Cue; readonly key: number } | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [levelup, setLevelup] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioManager>(new NoopAudioManager(() => undefined)).current;

  useEffect(() => {
    audio.setMusicMuted(settings.musicMuted);
    audio.setSfxMuted(settings.sfxMuted);
  }, [audio, settings.musicMuted, settings.sfxMuted]);

  useEffect(() => () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
  }, []);

  function trigger(cue: Cue) {
    audio.play(cues[cue].audioId);
    runCue(
      cue,
      reduced,
      (duration) => {
        setActive({ cue, key: Date.now() });
        if (timer.current !== null) {
          clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => {
          setActive(null);
          setFlight(null);
        }, duration);
        const stage = stageRef.current;
        if (stage !== null && (cue === "collect" || cue === "xp")) {
          const box = stage.getBoundingClientRect();
          const hud = document.querySelector(cue === "collect" ? '[data-testid="hud-coins"]' : '[data-testid="hud-xp"]');
          const origin = { x: box.left + box.width / 2, y: box.top + box.height * 0.7 };
          setFlight({
            cue,
            from: { x: origin.x - box.left, y: origin.y - box.top },
            to: hud === null ? { x: box.width * 0.15, y: 16 } : centerIn(box, hud),
            key: Date.now(),
          });
        }
        window.dispatchEvent(new CustomEvent("nf-fx", { detail: cue }));
      },
      setToast,
    );
    if (cue === "levelup") {
      setLevelup(true);
    }
  }

  useEffect(() => {
    if (!levelup) {
      return;
    }
    const timeout = scheduleDismiss(() => setLevelup(false));
    return () => clearTimeout(timeout);
  }, [levelup]);

  return (
    <section className="feedback" aria-label="Visual feedback showcase">
      <div className="feedback-hud">
        <span data-testid="hud-coins">Coins: 120</span>
        <span data-testid="hud-xp">XP: 40 / 100</span>
      </div>
      <div className="npc-list">
        {(["mia", "dana", "tom", "amir"] as const satisfies readonly Npc[]).map((npc) => (
          <NpcBadge key={npc} npc={npc} />
        ))}
      </div>
      <div className="feedback-controls">
        {demoCues.map((cue) => (
          <button type="button" key={cue} data-testid={`vfx-trigger-${cue}`} onClick={() => trigger(cue)}>
            {cue.replaceAll("-", " ")}
          </button>
        ))}
      </div>
      <div className="feedback-controls" aria-label="Settings">
        <button type="button" data-testid="toggle-music" aria-pressed={settings.musicMuted} onClick={() => settings.toggle("musicMuted")}>
          Music {settings.musicMuted ? "off" : "on"}
        </button>
        <button type="button" data-testid="toggle-sfx" aria-pressed={settings.sfxMuted} onClick={() => settings.toggle("sfxMuted")}>
          SFX {settings.sfxMuted ? "off" : "on"}
        </button>
        <button
          type="button"
          data-testid="toggle-reduced-motion"
          aria-pressed={settings.reducedMotion}
          onClick={() => settings.toggle("reducedMotion")}
        >
          Reduced motion {settings.reducedMotion ? "on" : "off"}
        </button>
      </div>
      <div className="franchise-demo">
        <span data-testid="franchise-branch">Branch</span>
        <span className={active?.cue === "franchise-bond" ? "bond animate" : "bond"} />
        <span data-testid="franchise-hq">HQ</span>
      </div>
      <div className="fx-stage" aria-hidden="true" ref={stageRef} key={active?.key}>
        {flight?.cue === "collect" &&
          Array.from({ length: 5 }, (_, index) => (
            <img
              className="coin-flight"
              key={index}
              src={resolveAssetUrl("ico_res_coin")}
              alt=""
              style={{
                left: flight.from.x + (index - 2) * 10,
                top: flight.from.y,
                "--dx": `${flight.to.x - flight.from.x - (index - 2) * 10}px`,
                "--dy": `${flight.to.y - flight.from.y}px`,
              } as CSSProperties}
            />
          ))}
        {flight?.cue === "xp" && (
          <img
            className="xp-flight"
            src={resolveAssetUrl("ico_res_xp")}
            alt=""
            style={{
              left: flight.from.x,
              top: flight.from.y,
              "--dx": `${flight.to.x - flight.from.x}px`,
              "--dy": `${flight.to.y - flight.from.y}px`,
            } as CSSProperties}
          />
        )}
        {active?.cue === "placement-pop" && <span className="placement-pop">+5 Residents</span>}
        {active?.cue === "sold-out" && (
          <span className="sold-out">
            <img src={resolveAssetUrl("ico_ui_alert")} alt="" /> Needs Supply
          </span>
        )}
        {active?.cue === "train-smoke" && Array.from({ length: 6 }, (_, index) => <span className={`smoke smoke-${index}`} key={index} />)}
      </div>
      <div className="fx-toast" data-testid="fx-toast" aria-live="polite">
        {toast}
      </div>
      {levelup && (
        <div className="levelup-layer">
          <button type="button" className="levelup-card" data-testid="vfx-levelup" onClick={() => setLevelup(false)}>
            Level up! <span>Tap to dismiss</span>
          </button>
        </div>
      )}
    </section>
  );
}
