import { useState } from "react";
import type { Snapshot } from "@nf/shared/schemas";
import { useSettings, type CollectPriority } from "../settings";
import { useCityStore } from "../api/store";

function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SettingsPanel({ snapshot, close }: { snapshot: Snapshot; close: () => void }) {
  const settings = useSettings();
  const enqueue = useCityStore(s => s.enqueue);
  const [confirmation, setConfirmation] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return <section className="city-panel nf-settings" data-testid="settings-panel"><h2>Settings</h2><button onClick={close}>Close</button>
    <button data-testid="settings-reduced-motion" aria-pressed={settings.reducedMotion} onClick={() => settings.toggle("reducedMotion")}>Reduced Motion: {settings.reducedMotion ? "On" : "Off"}</button>
    <button data-testid="settings-music" aria-pressed={!settings.musicMuted} onClick={() => settings.toggle("musicMuted")}>Music: {settings.musicMuted ? "Off" : "On"}</button>
    <button data-testid="settings-sfx" aria-pressed={!settings.sfxMuted} onClick={() => settings.toggle("sfxMuted")}>SFX: {settings.sfxMuted ? "Off" : "On"}</button>
    <label>Collect priority <select data-testid="settings-collect-priority" value={snapshot.city.collectPriority} onChange={e => { const priority = e.target.value as CollectPriority; settings.setPriority(priority); enqueue({ key: crypto.randomUUID(), name: "set-collect-priority", body: { priority } }); }}><option value="QUEST_FIRST">Quest First</option><option value="OLDEST_FIRST">Oldest First</option></select></label>
    <button data-testid="settings-recovery-code" onClick={() => setShowCode(!showCode)}>Recovery code</button>
    {showCode && <div><p>Save this code to restore your city: <code>{localStorage.getItem("nf_recovery_code") ?? "Unavailable"}</code></p><label>Restore a city <input value={code} onChange={e => setCode(e.target.value)} /></label><button onClick={() => { void import("../api/client").then(async ({ api }) => { try { const session = await api.session({ recoveryCode: code.trim() }); localStorage.setItem("nf_session_token", session.token); localStorage.setItem("nf_recovery_code", code.trim()); window.location.reload(); } catch { setError("Invalid recovery code"); } }); }}>Restore</button>{error && <p role="alert">{error}</p>}</div>}
    <button data-testid="settings-export-json" onClick={() => downloadFile(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }), "new-foundations-city.json")}>Export city JSON</button>
    <button data-testid="settings-reset" onClick={() => setConfirmation(1)}>Reset city</button>
    {confirmation === 1 && <div><p>Start a new city?</p><button data-testid="settings-reset-confirm-1" onClick={() => setConfirmation(2)}>Continue</button><button onClick={() => setConfirmation(0)}>Cancel</button></div>}
    {confirmation === 2 && <div><p>Confirm reset: your current city will be disconnected from this browser.</p><button data-testid="settings-reset-confirm-2" onClick={() => { localStorage.removeItem("nf_session_token"); localStorage.removeItem("nf_recovery_code"); window.location.reload(); }}>Reset city permanently</button><button onClick={() => setConfirmation(0)}>Cancel</button></div>}
  </section>;
}
