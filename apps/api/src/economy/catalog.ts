import {
  AGRICULTURE,
  BUILDINGS,
  DECORATIONS,
  ROAD,
  placeableFromBuilding,
  rotatedFootprint,
  type AgriculturePlot,
  type BuildingDefinition,
  type DecorationDefinition,
  type GoodId,
  type PlaceableDefinition,
  type QuarterTurns,
  type RoadDefinition,
} from "@nf/shared";
import { GOOD_IDS } from "@nf/shared/content";

export type Placeable =
  | { readonly kind: "building"; readonly definition: BuildingDefinition; readonly placeable: PlaceableDefinition }
  | { readonly kind: "agriculture"; readonly definition: AgriculturePlot; readonly placeable: PlaceableDefinition }
  | { readonly kind: "decoration"; readonly definition: DecorationDefinition; readonly placeable: PlaceableDefinition }
  | { readonly kind: "road"; readonly definition: RoadDefinition; readonly placeable: PlaceableDefinition };

const GOOD_ID_SET: ReadonlySet<string> = new Set(GOOD_IDS);

export function isGoodId(value: string): value is GoodId {
  return GOOD_ID_SET.has(value);
}

export function findPlaceable(id: string): Placeable | null {
  const building = BUILDINGS.find((entry) => entry.id === id);
  if (building !== undefined) {
    return { kind: "building", definition: building, placeable: placeableFromBuilding(building) };
  }
  const plot = AGRICULTURE.find((entry) => entry.id === id);
  if (plot !== undefined) {
    return {
      kind: "agriculture",
      definition: plot,
      placeable: {
        id: plot.id,
        category: "agriculture",
        footprint: plot.footprint,
        costCoins: plot.cost.coins,
        unlockLevel: plot.unlockLevel,
      },
    };
  }
  const decoration = DECORATIONS.find((entry) => entry.id === id);
  if (decoration !== undefined) {
    return {
      kind: "decoration",
      definition: decoration,
      placeable: {
        id: decoration.id,
        category: "decoration",
        footprint: decoration.footprint,
        costCoins: decoration.cost.coins,
        unlockLevel: decoration.unlockLevel,
      },
    };
  }
  if (id === ROAD.id) {
    return {
      kind: "road",
      definition: ROAD,
      placeable: {
        id: ROAD.id,
        category: "road",
        footprint: ROAD.footprint,
        costCoins: ROAD.cost.coins,
        unlockLevel: ROAD.unlockLevel,
      },
    };
  }
  return null;
}

export function catalogCost(placeable: Placeable): number {
  switch (placeable.kind) {
    case "building":
      return placeable.definition.cost.coins;
    case "agriculture":
      return placeable.definition.cost.coins;
    case "decoration":
      return placeable.definition.cost.coins;
    case "road":
      return placeable.definition.cost.coins;
    default: {
      const unreachable: never = placeable;
      throw new Error(`unknown placeable ${String(unreachable)}`);
    }
  }
}

export function footprintCells(
  definitionId: string,
  x: number,
  y: number,
  rotation: QuarterTurns,
): readonly { readonly x: number; readonly y: number }[] {
  const placeable = findPlaceable(definitionId);
  const footprint = placeable?.placeable.footprint ?? { width: 1, height: 1 };
  const size = rotatedFootprint(footprint.width, footprint.height, rotation);
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < size.height; dy += 1) {
    for (let dx = 0; dx < size.width; dx += 1) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

export type BuildingStock = {
  readonly goods: Partial<Record<GoodId, number>>;
  readonly pendingCoins: number;
  readonly tutorialCycle: boolean;
  readonly tutorialUsed: boolean;
  readonly paidCoins?: number;
};

export function emptyStock(): BuildingStock {
  return { goods: {}, pendingCoins: 0, tutorialCycle: false, tutorialUsed: false };
}

export function cloneStock(stock: BuildingStock): BuildingStock {
  return {
    goods: { ...stock.goods },
    pendingCoins: stock.pendingCoins,
    tutorialCycle: stock.tutorialCycle,
    tutorialUsed: stock.tutorialUsed,
    ...(stock.paidCoins === undefined ? {} : { paidCoins: stock.paidCoins }),
  };
}

export function parseStock(value: unknown): BuildingStock {
  if (!isRecord(value)) {
    return emptyStock();
  }
  if ("goods" in value || "pendingCoins" in value || "tutorialCycle" in value || "tutorialUsed" in value || "paidCoins" in value) {
    return {
      goods: parseGoods(value.goods),
      pendingCoins: nonNegativeInt(value.pendingCoins),
      tutorialCycle: value.tutorialCycle === true,
      tutorialUsed: value.tutorialUsed === true,
      ...(typeof value.paidCoins === "number" && Number.isInteger(value.paidCoins) && value.paidCoins >= 0
        ? { paidCoins: value.paidCoins }
        : {}),
    };
  }
  return { goods: parseGoods(value), pendingCoins: 0, tutorialCycle: false, tutorialUsed: false };
}

export function serializeStock(stock: BuildingStock): Record<string, unknown> {
  return {
    goods: stock.goods,
    pendingCoins: stock.pendingCoins,
    tutorialCycle: stock.tutorialCycle,
    tutorialUsed: stock.tutorialUsed,
    ...(stock.paidCoins === undefined ? {} : { paidCoins: stock.paidCoins }),
  };
}

export type OutputReady = { readonly goodId: GoodId; readonly qty: number };

export function parseOutput(value: unknown): OutputReady | null {
  if (!isRecord(value) || typeof value.goodId !== "string" || !isGoodId(value.goodId)) {
    return null;
  }
  if (typeof value.qty !== "number" || !Number.isInteger(value.qty) || value.qty <= 0) {
    return null;
  }
  return { goodId: value.goodId, qty: value.qty };
}

export function serializeOutput(output: OutputReady | null): { goodId?: string; qty?: number } {
  return output === null ? {} : { goodId: output.goodId, qty: output.qty };
}

export function serializeStacks(stacks: readonly { readonly goodId: GoodId; readonly qty: number }[]): Record<string, unknown> {
  return { items: stacks.map((stack) => ({ goodId: stack.goodId, qty: stack.qty })) };
}

export function parseStacks(value: unknown): readonly { readonly goodId: GoodId; readonly qty: number }[] {
  const entries = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.items) ? value.items : [];
  const stacks: { goodId: GoodId; qty: number }[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.goodId !== "string" || !isGoodId(entry.goodId)) {
      continue;
    }
    if (typeof entry.qty !== "number" || !Number.isInteger(entry.qty) || entry.qty <= 0) {
      continue;
    }
    stacks.push({ goodId: entry.goodId, qty: entry.qty });
  }
  return stacks;
}

export function goodsUnitCount(goods: Partial<Record<GoodId, number>>): number {
  let total = 0;
  for (const qty of Object.values(goods)) {
    total += qty ?? 0;
  }
  return total;
}

export function fullInputCycles(
  goods: Partial<Record<GoodId, number>>,
  inputs: readonly { readonly goodId: GoodId; readonly qty: number }[],
): number {
  if (inputs.length === 0) {
    return 0;
  }
  let cycles = Number.POSITIVE_INFINITY;
  for (const line of inputs) {
    cycles = Math.min(cycles, Math.floor((goods[line.goodId] ?? 0) / line.qty));
  }
  return Number.isFinite(cycles) ? cycles : 0;
}

export function consumeInputCycle(
  goods: Partial<Record<GoodId, number>>,
  inputs: readonly { readonly goodId: GoodId; readonly qty: number }[],
): Partial<Record<GoodId, number>> | null {
  if (fullInputCycles(goods, inputs) < 1) {
    return null;
  }
  const spent = new Map(inputs.map((line) => [line.goodId, line.qty]));
  const next: Partial<Record<GoodId, number>> = {};
  for (const [goodId, qty] of Object.entries(goods)) {
    if (!isGoodId(goodId) || qty === undefined) {
      continue;
    }
    const remaining = qty - (spent.get(goodId) ?? 0);
    if (remaining > 0) {
      next[goodId] = remaining;
    }
  }
  return next;
}

function parseGoods(value: unknown): Partial<Record<GoodId, number>> {
  if (!isRecord(value)) {
    return {};
  }
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [goodId, qty] of Object.entries(value)) {
    if (!isGoodId(goodId) || typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0) {
      continue;
    }
    goods[goodId] = qty;
  }
  return goods;
}

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
