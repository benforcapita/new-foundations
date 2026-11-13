import { byId, type NpcCityId, type NpcId } from "./ids";

export type NpcDefinition = {
  readonly id: NpcId;
  readonly nameKey: string;
  readonly summaryKey: string;
  readonly role: "civic_engineer" | "merchant" | "station_manager" | "gardener";
  readonly homeBuildingId?: "B-009" | "B-011";
};

export type NpcCityDefinition = {
  readonly id: NpcCityId;
  readonly nameKey: string;
  readonly npcId: NpcId;
  readonly kind: "commerce" | "garden";
  readonly acceptsVisits: true;
  readonly acceptsFranchises: true;
};

export const NPCS: readonly NpcDefinition[] = [
  {
    id: "NPC-MIA",
    nameKey: "npc.mia.name",
    summaryKey: "npc.mia.summary",
    role: "civic_engineer",
    homeBuildingId: "B-009",
  },
  {
    id: "NPC-DANA",
    nameKey: "npc.dana.name",
    summaryKey: "npc.dana.summary",
    role: "merchant",
  },
  {
    id: "NPC-TOM",
    nameKey: "npc.tom.name",
    summaryKey: "npc.tom.summary",
    role: "station_manager",
    homeBuildingId: "B-011",
  },
  {
    id: "NPC-AMIR",
    nameKey: "npc.amir.name",
    summaryKey: "npc.amir.summary",
    role: "gardener",
  },
];

export const NPC_CITIES: readonly NpcCityDefinition[] = [
  {
    id: "NPC-CITY-DANA",
    nameKey: "npc.dana.city.name",
    npcId: "NPC-DANA",
    kind: "commerce",
    acceptsVisits: true,
    acceptsFranchises: true,
  },
  {
    id: "NPC-CITY-AMIR",
    nameKey: "npc.amir.garden.name",
    npcId: "NPC-AMIR",
    kind: "garden",
    acceptsVisits: true,
    acceptsFranchises: true,
  },
];

export function npcById(id: NpcId): NpcDefinition {
  return byId(NPCS, id, "npc");
}
