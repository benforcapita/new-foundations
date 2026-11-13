import { catalogAvailability, hasReady } from "./cityPanelState";
import { useEffect, useRef, useState } from "react";
import { AGRICULTURE, BUILDINGS, LEVELS, QUESTS, RECIPES, loadEnglishLocalization } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import { useCityStore } from "../api/store";
import { usePlacementStore, useSceneStore } from "../game/scene-store";

const labels = loadEnglishLocalization();
const label = (key: string, fallback: string) => labels[key] ?? fallback;
const total = (snapshot: Snapshot) => Object.values(snapshot.inventory).reduce((sum, n) => sum + n, 0);
function feedback() {
  if (useSceneStore.getState().reducedMotion) window.dispatchEvent(new CustomEvent("nf-announce", { detail: "Collected" }));
  else { window.dispatchEvent(new CustomEvent("nf-fx", { detail: "collect" })); window.dispatchEvent(new CustomEvent("nf-fx", { detail: "xp" })); }
}
export function CityPanels({ snapshot }: { snapshot: Snapshot | null }) {
  const [panel, setPanel] = useState<"catalog" | "warehouse" | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const timeBase = useRef({ server: snapshot?.serverNow, received: Date.now() });
  if (timeBase.current.server !== snapshot?.serverNow) timeBase.current = { server: snapshot?.serverNow, received: Date.now() };
  const selectedId = useSceneStore(s => s.selectedId);
  const building = snapshot?.buildings.find(b => b.id === selectedId);
  const definition = building && [...BUILDINGS, ...AGRICULTURE].find(d => d.id === building.definitionId);
  const ready = hasReady(snapshot);
  const enqueue = useCityStore(s => s.enqueue);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(timer); }, [undo]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape") { setPanel(null); useSceneStore.getState().publish({ selectedId: null }); return; }
      if (event.key.toLowerCase() !== "c" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if (ready) { enqueue({ key: crypto.randomUUID(), name: "collect-all", body: {} }); feedback(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [ready, enqueue]);
  const quest = snapshot?.quests.find(q => q.status === "ACTIVE");
  const xp = snapshot && LEVELS.find(l => l.level === snapshot.city.level)?.xpToNext;
  const serverClock = snapshot ? Date.parse(snapshot.serverNow) + (clock - timeBase.current.received) : clock;
  return <>
    <section className="city-hud" aria-label="City status">
      <span>Level {snapshot?.city.level ?? "—"}</span>
      <span data-testid="hud-xp">XP: {snapshot?.city.xp ?? 0} / {xp ?? "MAX"}</span>
      {xp != null && <progress aria-label="XP progress" value={snapshot?.city.xp ?? 0} max={xp} />}
      <span data-testid="hud-coins">Coins: {snapshot?.city.coins ?? 0}</span><span>Gems: {snapshot?.city.gems ?? 0}</span>
      <button type="button" onClick={() => setPanel("warehouse")}>Warehouse {snapshot ? `${total(snapshot)}/${snapshot.city.warehouseCap}` : "—"}</button>
      <span>Quest: {quest ? label(QUESTS.find(q => q.id === quest.questId)?.nameKey ?? "", quest.questId) : "None"}</span>
      <button type="button" data-testid="collect-all" disabled={!ready} onClick={() => { enqueue({ key: crypto.randomUUID(), name: "collect-all", body: {} }); feedback(); }}>Collect All (C)</button>
      <button type="button" data-testid="build-catalog-open" onClick={() => setPanel("catalog")}>Build</button>
    </section>
    {panel === "catalog" && snapshot && <section className="city-panel" aria-label="Build catalog"><h2>Build catalog</h2><button type="button" onClick={() => setPanel(null)}>Close</button>
      {[...BUILDINGS.filter(b => !b.prebuilt), ...AGRICULTURE].map(d => {
        const { locked, affordable, cost } = catalogAvailability(snapshot, d);
        return <div key={d.id} data-testid={`catalog-item-${d.id}`}><button type="button" disabled={locked || !affordable} onClick={() => { usePlacementStore.getState().select(d.id); setPanel(null); }}>{label(d.nameKey, d.id)} ({d.id}) — {cost} coins</button>{locked && <span data-testid={`catalog-lock-${d.id}`}> Locked: requires level {d.unlockLevel}</span>}{!locked && !affordable && <span> Not enough coins</span>}</div>;
      })}</section>}
    {panel === "warehouse" && snapshot && <section className="city-panel" data-testid="warehouse-panel"><h2>Warehouse</h2><button type="button" onClick={() => setPanel(null)}>Close</button><p data-testid="warehouse-cap">{total(snapshot)}/{snapshot.city.warehouseCap}</p><ul>{Object.entries(snapshot.inventory).map(([id, count]) => <li key={id}>{id}: {count}</li>)}</ul></section>}
    {building && definition && snapshot && <section className="city-panel" data-testid="building-details"><h2>{label(definition.nameKey, definition.id)} ({definition.id})</h2><p>State: {building.state}</p><button type="button" onClick={() => useSceneStore.getState().publish({ selectedId: null })}>Close</button>
      <button type="button" data-testid="details-move" onClick={() => { usePlacementStore.getState().select(definition.id); useSceneStore.getState().publish({ moveId: building.id, selectedId: null }); }}>Move</button>
      <button type="button" data-testid="details-remove" onClick={() => { enqueue({ key: crypto.randomUUID(), name: "remove-building", body: { instanceId: building.id } }); setUndo(building.id); useSceneStore.getState().publish({ selectedId: null }); }}>Remove</button>
      {building.state === "NEEDS_SUPPLY" && <button type="button" data-testid="details-supply" onClick={() => enqueue({ key: crypto.randomUUID(), name: "supply-business", body: { instanceId: building.id } })}>Supply</button>}
      {building.state === "READY_TO_COLLECT" && <button type="button" data-testid="details-collect" onClick={() => { enqueue({ key: crypto.randomUUID(), name: "collect", body: { instanceId: building.id } }); feedback(); }}>Collect</button>}
      {"stockInput" in definition && <p>Inputs: {definition.stockInput.map(i => `${i.goodId} ${i.qty} (stored ${snapshot.inventory[i.goodId] ?? 0})`).join(", ")}</p>}
      {"outputGoodId" in definition && <p>Output: {definition.outputQty} {definition.outputGoodId}</p>}
      {"category" in definition && definition.category === "production" && <div data-testid="production-queue"><h3>Production queue</h3><p>Slots: {snapshot.jobs.filter(j => j.buildingId === building.id).length}/{snapshot.city.level >= 5 ? 3 : 2}</p>
        {snapshot.jobs.filter(j => j.buildingId === building.id).map(j => <p key={j.id}>Slot {j.slot + 1}: {j.recipeId} — {Math.max(0, Math.ceil((Date.parse(j.completesAt) - serverClock) / 1000))}s <button type="button" data-testid="cancel-production" disabled={j.id.startsWith("pending:")} onClick={() => enqueue({ key: crypto.randomUUID(), name: "cancel-production", body: { instanceId: building.id, jobId: j.id } })}>Cancel</button></p>)}
        {RECIPES.filter(r => r.buildingId === definition.id).map(r => <p key={r.id}>{label(r.nameKey, r.id)}: {r.inputs.map(i => `${i.qty} ${i.goodId}`).join(", ")} → {r.outputs.map(i => `${i.qty} ${i.goodId}`).join(", ")} <button type="button" data-testid="start-production" disabled={snapshot.city.level < r.unlockLevel || snapshot.jobs.filter(j => j.buildingId === building.id).length >= (snapshot.city.level >= 5 ? 3 : 2) || r.inputs.some(i => (snapshot.inventory[i.goodId] ?? 0) < i.qty)} onClick={() => enqueue({ key: crypto.randomUUID(), name: "start-production", body: { instanceId: building.id, recipeId: r.id } })}>Start</button></p>)}
      </div>}
    </section>}
    {undo && <div role="status">Building removed. <button type="button" onClick={() => { enqueue({ key: crypto.randomUUID(), name: "remove-building", body: { instanceId: undo, undo: true } }); setUndo(null); }}>Undo</button></div>}
  </>;
}
