export type RemovalBlock = "LAST_WHEAT_PLOT" | "TOWN_HALL";

export function needsRecoveryOrder(coins: number, openOrders: readonly { readonly solvable: boolean }[]): boolean {
  return coins < 180 && openOrders.every((order) => !order.solvable);
}

export function removalBlock(input: {
  readonly definitionId: string;
  readonly placedDefinitionIds: readonly string[];
}): RemovalBlock | null {
  if (input.definitionId === "AG-001") {
    const wheatPlots = input.placedDefinitionIds.filter((id) => id === "AG-001").length;
    if (wheatPlots <= 1) {
      return "LAST_WHEAT_PLOT";
    }
  }
  if (input.definitionId === "B-009") {
    const townHalls = input.placedDefinitionIds.filter((id) => id === "B-009").length;
    if (townHalls <= 1) {
      return "TOWN_HALL";
    }
  }
  return null;
}

export type WarehouseCollect = {
  readonly collected: number;
  readonly remaining: number;
  readonly waiting: boolean;
  readonly blocked: boolean;
};

export function collectReadyOutput(input: {
  readonly used: number;
  readonly cap: number;
  readonly readyUnits: number;
}): WarehouseCollect {
  if (input.used < 0 || input.cap < 0 || input.readyUnits < 0) {
    throw new Error("warehouse amounts must be non-negative");
  }
  const free = Math.max(0, input.cap - input.used);
  const collected = Math.min(input.readyUnits, free);
  const remaining = input.readyUnits - collected;
  return {
    collected,
    remaining,
    waiting: remaining > 0,
    blocked: collected === 0 && input.readyUnits > 0,
  };
}
