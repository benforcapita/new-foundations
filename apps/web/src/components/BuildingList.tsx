import { gridToScreen } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../game/layout";
import { useSceneStore } from "../game/scene-store";
import { buildingStatus, statusIcon } from "./buildingStatus";
export function BuildingList({ snapshot, close }: { snapshot: Snapshot; close: () => void }) {
  return <section className="city-panel nf-list" data-testid="building-list"><h2>District Building List</h2><button onClick={close}>Close</button>{snapshot.buildings.map(b => <button key={b.id} data-testid={`building-list-row-${b.id}`} onClick={() => { const point = gridToScreen(b.x + 0.5, b.y + 0.5, MAP_ORIGIN_X, MAP_ORIGIN_Y); const scene = useSceneStore.getState(); scene.aimAt(point.x, point.y, scene.zoom); scene.publish({ selectedId: b.id }); close(); }}><span aria-hidden="true" data-testid="building-status-icon" data-status={buildingStatus(b.state)}>{statusIcon(b.state)}</span> {b.definitionId} — {buildingStatus(b.state)}</button>)}</section>;
}
