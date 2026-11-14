import { canPlaceFlowerBench, catalogAvailability, hasReady } from "./cityPanelState";
import { useEffect, useRef, useState } from "react";
import { AGRICULTURE, BUILDINGS, DECORATIONS, LEVELS, QUESTS, RECIPES, canPlace, loadEnglishLocalization } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import { useCityStore } from "../api/store";
import { livePlacementCity } from "../game/liveCity";
import { usePlacementStore, useSceneStore } from "../game/scene-store";

const labels = loadEnglishLocalization();
const label = (key: string, fallback: string) => labels[key] ?? fallback;
const total = (snapshot: Snapshot) => Object.values(snapshot.inventory).reduce((sum, n) => sum + n, 0);
function feedback() {
  if (useSceneStore.getState().reducedMotion) window.dispatchEvent(new CustomEvent("nf-announce", { detail: "Collected" }));
  else { window.dispatchEvent(new CustomEvent("nf-fx", { detail: "collect" })); window.dispatchEvent(new CustomEvent("nf-fx", { detail: "xp" })); }
}
export function CityPanels({ snapshot }: { snapshot: Snapshot | null }) {
  const [panel, setPanel] = useState<"catalog" | "warehouse" | "quests" | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [levelUp, setLevelUp] = useState<{ level: number; unlocks: readonly string[] } | null>(null);
  const previousLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const level = snapshot.city.level;
    const previous = previousLevel.current;
    if (previous !== null && level > previous) {
      setLevelUp({ level, unlocks: LEVELS.filter(entry => entry.level > previous && entry.level <= level).flatMap(entry => entry.unlocks) });
    }
    previousLevel.current = level;
  }, [snapshot]);
  const timeBase = useRef({ server: snapshot?.serverNow, received: Date.now() });
  if (timeBase.current.server !== snapshot?.serverNow) timeBase.current = { server: snapshot?.serverNow, received: Date.now() };
  const selectedId = useSceneStore(s => s.selectedId);
  const building = snapshot?.buildings.find(b => b.id === selectedId);
  const definition = building && [...BUILDINGS, ...AGRICULTURE, ...DECORATIONS].find(d => d.id === building.definitionId);
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
  const currentLevel = snapshot?.city.level ?? 1;
  const priorXp = LEVELS.filter(l => l.level < currentLevel).reduce((sum, l) => sum + (l.xpToNext ?? 0), 0);
  const xp = LEVELS.find(l => l.level === currentLevel)?.xpToNext;
  const serverClock = snapshot ? Date.parse(snapshot.serverNow) + (clock - timeBase.current.received) : clock;
  return <>
    {levelUp && <div className="levelup-layer"><section className="levelup-card" role="dialog" aria-label="Level up" aria-live="polite"><h2>Level {levelUp.level}!</h2><p>Unlocked: {levelUp.unlocks.map(id => { const item = [...BUILDINGS, ...AGRICULTURE, ...DECORATIONS].find(d => d.id === id); return item ? label(item.nameKey, id) : id; }).join(", ") || "No new items"}</p><button type="button" onClick={() => setLevelUp(null)}>Dismiss</button></section></div>}
    <section className="city-hud" aria-label="City status">
      <span>Level {snapshot?.city.level ?? "—"}</span>
      <span data-testid="hud-xp">XP: {xp === null ? "MAX" : `${Math.max(0, (snapshot?.city.xp ?? 0) - priorXp)} / ${xp}`}</span>
      {xp != null && <progress aria-label="XP progress" value={Math.max(0, (snapshot?.city.xp ?? 0) - priorXp)} max={xp} />}
      <span data-testid="hud-coins">Coins: {snapshot?.city.coins ?? 0}</span><span>Gems: {snapshot?.city.gems ?? 0}</span>
      <button type="button" onClick={() => setPanel("warehouse")}>Warehouse {snapshot ? `${total(snapshot)}/${snapshot.city.warehouseCap}` : "—"}</button>
      <button type="button" data-testid="quest-tracker-open" onClick={() => setPanel("quests")}>Quest: {quest ? label(QUESTS.find(q => q.id === quest.questId)?.nameKey ?? "", quest.questId) : "None"}</button>
      <button type="button" data-testid="collect-all" disabled={!ready} onClick={() => { enqueue({ key: crypto.randomUUID(), name: "collect-all", body: {} }); feedback(); }}>Collect All (C)</button>
      <button type="button" data-testid="build-catalog-open" onClick={() => setPanel("catalog")}>Build</button>
    </section>
    {snapshot && panel === "quests" && <section className="city-panel" data-testid="quest-tracker" aria-label="Quests">
      <h2>Quests</h2><button type="button" onClick={() => setPanel(null)}>Close</button>
      {snapshot.quests.filter(q => q.status !== "CLAIMED" || (q.questId === "quest_flower_street" && canPlaceFlowerBench(snapshot))).map(q => {
        const def = QUESTS.find(item => item.id === q.questId);
        return <article key={`${q.questId}:${q.periodKey}`} data-testid={`quest-card-${q.questId}`}>
          <strong>{label(def?.nameKey ?? "", q.questId)}</strong> <span>{q.status}</span>
          {def?.steps.map((step, index) => <div key={index}>{step.event.replaceAll("_", " ")}: {q.stepState[String(index)] ?? 0}/{step.amount}</div>)}
          {q.questId === "quest_flower_street" && canPlaceFlowerBench(snapshot) && <button type="button" data-testid="place-flower-bench" onClick={() => {
            const bench = DECORATIONS.find(d => d.id === "D-003");
            if (!bench) return;
            const city = livePlacementCity(snapshot);
            const definition = { id: bench.id, category: "decoration" as const, footprint: bench.footprint, costCoins: 0, unlockLevel: 1 };
            const cell = snapshot.cells.find(c => canPlace(city, definition, c.x, c.y, 0).ok);
            if (cell) enqueue({ key: crypto.randomUUID(), name: "place-building", body: { definitionId: "D-003", x: cell.x, y: cell.y, rotation: 0 } });
          }}>Place Flower Street bench</button>}
          {q.status === "COMPLETED" && <button type="button" data-testid={`quest-claim-${q.questId}`} onClick={() => { enqueue({ key: crypto.randomUUID(), name: "claim-quest", body: { questId: q.questId, periodKey: q.periodKey } }); feedback(); }}>Claim</button>}
        </article>;
      })}
    </section>}
    {panel === "catalog" && snapshot && <section className="city-panel" aria-label="Build catalog"><h2>Build catalog</h2><button type="button" onClick={() => setPanel(null)}>Close</button>
      {[...BUILDINGS, ...AGRICULTURE, ...DECORATIONS].map(d => {
        const { locked, affordable, cost } = catalogAvailability(snapshot, d);
        return <div key={d.id} data-testid={`catalog-item-${d.id}`}><button type="button" disabled={locked || !affordable} onClick={() => { usePlacementStore.getState().select(d.id); setPanel(null); }}>{label(d.nameKey, d.id)} ({d.id}) — {cost} coins</button>{locked && <span data-testid={`catalog-lock-${d.id}`}> Locked: requires level {d.unlockLevel}</span>}{!locked && !affordable && <span> Not enough coins</span>}</div>;
      })}</section>}
    {panel === "warehouse" && snapshot && <section className="city-panel" data-testid="warehouse-panel"><h2>Warehouse</h2><button type="button" onClick={() => setPanel(null)}>Close</button><p data-testid="warehouse-cap">{total(snapshot)}/{snapshot.city.warehouseCap}</p><ul>{Object.entries(snapshot.inventory).map(([id, count]) => <li key={id}>{id}: {count}</li>)}</ul></section>}
    {building && definition && snapshot && <section className="city-panel" data-testid="building-details"><h2>{label(definition.nameKey, definition.id)} ({definition.id})</h2><p>State: {building.state}</p><button type="button" onClick={() => useSceneStore.getState().publish({ selectedId: null })}>Close</button>
      {!DECORATIONS.some(d => d.id === definition.id) && <button type="button" data-testid="details-move" onClick={() => { usePlacementStore.getState().select(definition.id as Parameters<ReturnType<typeof usePlacementStore.getState>["select"]>[0]); useSceneStore.getState().publish({ moveId: building.id, selectedId: null }); }}>Move</button>}
      <button type="button" data-testid="details-remove" onClick={() => { enqueue({ key: crypto.randomUUID(), name: "remove-building", body: { instanceId: building.id } }); setUndo(building.id); useSceneStore.getState().publish({ selectedId: null }); }}>Remove</button>
      {building.state === "NEEDS_SUPPLY" && <button type="button" data-testid="details-supply" onClick={() => enqueue({ key: crypto.randomUUID(), name: "supply-business", body: { instanceId: building.id } })}>Supply</button>}
      {(building.state === "READY_TO_COLLECT" || (building.definitionId === "B-004" && building.state === "ACTIVE")) && <button type="button" data-testid="details-collect" onClick={() => { enqueue({ key: crypto.randomUUID(), name: "collect", body: { instanceId: building.id } }); feedback(); }}>Collect</button>}
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
