import type { Snapshot } from "@nf/shared/schemas";
import type { CommandBody } from "./client";

export type PendingCommand =
  | { key: string; name: "place-building"; body: CommandBody<"place-building"> }
  | { key: string; name: "move-building"; body: CommandBody<"move-building"> }
  | { key: string; name: "collect"; body: CommandBody<"collect"> };

export function composeSnapshot(snapshot: Snapshot, queue: readonly PendingCommand[]): Snapshot {
  let buildings = [...snapshot.buildings];
  for (const command of queue) {
    if (command.name === "place-building") {
      buildings.push({ id: `pending:${command.key}`, definitionId: command.body.definitionId, x: command.body.x, y: command.body.y, rotation: command.body.rotation, state: "UNDER_CONSTRUCTION", level: 1, version: 0 });
    } else if (command.name === "move-building") {
      const body = command.body;
      buildings = buildings.map((building) => building.id === body.instanceId ? { ...building, x: body.x, y: body.y, rotation: body.rotation } : building);
    } else {
      const body = command.body;
      buildings = buildings.map((building) => building.id === body.instanceId ? { ...building, state: "ACTIVE" } : building);
    }
  }
  return { ...snapshot, buildings };
}
