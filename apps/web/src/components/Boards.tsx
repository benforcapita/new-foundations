import { useEffect, useRef, useState } from "react";
import { GOODS, loadEnglishLocalization } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import { api, type FranchiseHost } from "../api/client";
import { useCityStore } from "../api/store";
import { resolveAssetUrl } from "../game/assetUrls";
import { useSceneStore } from "../game/scene-store";
import { NpcBadge } from "./NpcBadge";

const labels = loadEnglishLocalization();
function Good({ id }: { id: string }) {
  const good = GOODS.find(g => g.id === id);
  let url = "";
  try { if (good) url = resolveAssetUrl(good.iconAssetId); } catch { /* Some goods have no bundled icon. */ }
  return <span>{url && <img className="good-icon" src={url} alt="" data-testid={good?.iconAssetId} />} {good ? labels[good.nameKey] ?? id : id}</span>;
}
export function OrderBoard({ snapshot, cooldown, onFulfill, onReroll }: { snapshot: Snapshot; cooldown: number; onFulfill: (id: string) => void; onReroll: (id: string) => void }) {
  return <section data-testid="order-board"><h2>Order Board</h2>{snapshot.orders.filter(o => o.status === "OPEN").map(order => <article className="board-card" data-testid="order-card" key={order.id}>
    <h3>Order {order.slot + 1}</h3><p>{order.templateId}</p>
    {Object.entries(order.requirements).map(([id, qty]) => <p key={id}><Good id={id} />: {snapshot.inventory[id as keyof typeof snapshot.inventory] ?? 0} / {qty}</p>)}
    <p>{order.reward.coins} Coins / {order.reward.xp} XP / {order.reward.civicStars} Civic Stars</p>
    <button type="button" data-testid="order-fulfill" disabled={Object.entries(order.requirements).some(([id, qty]) => (snapshot.inventory[id as keyof typeof snapshot.inventory] ?? 0) < qty)} onClick={() => onFulfill(order.id)}>Fulfill</button>
    <button type="button" data-testid="order-reroll" disabled={cooldown > 0} onClick={() => onReroll(order.id)}>Reroll</button>
  </article>)}{cooldown > 0 && <p data-testid="order-reroll-cooldown">Free reroll in {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}</p>}</section>;
}
export function FranchiseView({ host, branch, cycles, setCycles, onRequest, onSupply, onCollect, split, busy }: { host?: FranchiseHost; branch?: Snapshot["franchises"][number]; cycles: 1 | 2; setCycles: (n: 1 | 2) => void; onRequest: () => void; onSupply: () => void; onCollect: () => void; split: { ownerAmount: number; hostAmount: number; total: number } | null; busy: boolean }) {
  return <section data-testid="franchise-board"><h2>Franchise Board</h2>{host && <article className="board-card" data-testid="franchise-host-dana_city"><h3>{host.name}</h3><NpcBadge npc="dana" /><p>Available plots: {host.plots.length ? host.plots.map(p => `2×2 at ${p.x}, ${p.y}`).join("; ") : "None"}</p><p>Required: {host.requiredGoods.map(g => <span key={g.goodId}>{g.qty} <Good id={g.goodId} /></span>)}</p><p>Expected cycle profit: {host.expectedCycleProfit} Coins</p><p>{host.splitBps.owner / 100}% you / {host.splitBps.host / 100}% Dana</p>{!branch && <button type="button" data-testid="franchise-request" disabled={busy || !host.plots.length} onClick={onRequest}>Request branch</button>}</article>}
    {branch && <article className="board-card" data-testid="franchise-branch"><h3>Dana's City branch</h3><p>Status: {branch.state}</p><label>Supply cycles <select data-testid="franchise-supply-cycles" value={cycles} onChange={e => setCycles(Number(e.target.value) === 2 ? 2 : 1)}><option value={1}>1 cycle</option><option value={2}>2 cycles</option></select></label><button type="button" data-testid="franchise-supply" disabled={busy} onClick={onSupply}>Supply</button><button type="button" data-testid="franchise-collect" disabled={busy} onClick={onCollect}>Collect</button>{split && <p data-testid="franchise-split">You: {split.ownerAmount} / Dana: {split.hostAmount} / Total: {split.total}</p>}</article>}</section>;
}
export function HqBadge({ owned }: { owned: boolean }) { return owned ? <span data-testid="hq-badge">Franchise HQ</span> : null; }
export function Boards({ snapshot }: { snapshot: Snapshot }) {
  const [panel, setPanel] = useState<"orders" | "franchise" | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [hosts, setHosts] = useState<FranchiseHost[]>([]);
  const [cycles, setCycles] = useState<1 | 2>(1);
  const [split, setSplit] = useState<{ ownerAmount: number; hostAmount: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ action: string; key: string } | null>(null);
  const session = useCityStore(s => s.session);
  const enqueue = useCityStore(s => s.enqueue);
  const queue = useCityStore(s => s.queue);
  const host = hosts.find(h => h.npcKey === "dana_city");
  const branch = snapshot.franchises.find(f => f.ownerCityId === snapshot.city.cityId && f.state === "ACTIVE");
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  useEffect(() => { if (panel === "franchise" && session) api.franchiseHosts(session.token).then(setHosts).catch(e => setError(String(e))); }, [panel, session]);
  const cooldown = Math.max(0, Math.ceil((Number(localStorage.getItem(`nf_reroll:${snapshot.city.cityId}`) ?? 0) - tick) / 1000));
  const pendingReroll = queue.some(c => c.name === "reroll-order");
  async function act(action: "request" | "supply" | "collect") {
    if (!session || busy) return;
    const actionId = `${action}:${action === "supply" ? cycles : ""}`;
    const key = retry.current?.action === actionId ? retry.current.key : crypto.randomUUID();
    retry.current = { action: actionId, key }; setBusy(true); setError("");
    try {
      if (action === "request" && host?.plots[0]) await api.franchiseRequest(session.token, host.cityId, host.plots[0].plotId, key);
      else if (action === "supply" && branch) await api.franchiseSupply(session.token, branch.id, cycles, key);
      else if (action === "collect" && branch) { const result = await api.franchiseCollect(session.token, branch.id, key); setSplit({ ownerAmount: result.ownerAmount ?? 0, hostAmount: result.hostAmount ?? 0, total: result.total ?? 0 }); }
      else return;
      const [fresh, newHosts] = await Promise.all([api.snapshot(session.token, session.cityId), api.franchiseHosts(session.token)]);
      useCityStore.setState({ snapshot: fresh }); setHosts(newHosts); retry.current = null;
    } catch (e) { setError(`Franchise action failed: ${String(e)}. Try again.`); } finally { setBusy(false); }
  }
  return <><div className="board-controls"><button type="button" data-testid="order-board-open" onClick={() => setPanel("orders")}>Orders</button><button type="button" data-testid="franchise-board-open" onClick={() => setPanel("franchise")}>Franchises</button><HqBadge owned={Boolean(branch)} /></div>
    {panel && <div className="city-panel board-panel"><button type="button" onClick={() => setPanel(null)}>Close</button>{panel === "orders" ? <OrderBoard snapshot={snapshot} cooldown={pendingReroll ? 900 : cooldown} onFulfill={id => { enqueue({ key: crypto.randomUUID(), name: "fulfill-order", body: { orderId: id } }); if (useSceneStore.getState().reducedMotion) window.dispatchEvent(new CustomEvent("nf-announce", { detail: "Order fulfilled" })); else { window.dispatchEvent(new CustomEvent("nf-fx", { detail: "collect" })); window.dispatchEvent(new CustomEvent("nf-fx", { detail: "xp" })); } }} onReroll={id => enqueue({ key: crypto.randomUUID(), name: "reroll-order", body: { orderId: id } })} /> : <FranchiseView host={host} branch={branch} cycles={cycles} setCycles={setCycles} onRequest={() => void act("request")} onSupply={() => void act("supply")} onCollect={() => void act("collect")} split={split} busy={busy} />}{error && <p role="alert">{error}</p>}</div>}</>;
}
