import { nextSupplyStreak } from "../economy/franchise";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { franchiseSplit, franchiseTotal, transitionFranchise } from "@nf/shared";
import { transitionFranchiseShipment } from "@nf/shared/rules";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "../db/client";
import { cities, cityCells, franchises, franchiseShipments, inventoryBalances, inventoryLedger } from "../db/schema";
import { ApiError } from "../errors";
import type { Actor } from "../plugins/auth";
import { runCommand, type CommandContext, type CommandEffects } from "../plugins/idempotency";
import type { RateLimiter } from "../plugins/rateLimit";
import { sha256Hex } from "../crypto";
import { prepareCommand } from "./commands";

export async function franchiseHosts(db: Database) {
  const hosts = await db.select().from(cities).where(eq(cities.isNpc, true));
  const result = [];
  for (const host of hosts) {
    const cells = await db.select().from(cityCells).where(and(eq(cityCells.cityId, host.id), eq(cityCells.cellRole, "franchise_plot")));
    const active = await db.select().from(franchises).where(and(eq(franchises.hostCity, host.id), inArray(franchises.state, ["REQUESTED", "ACCEPTED", "ACTIVE", "PAUSED"])));
    const plots = plotOrigins(cells).filter((plot) => !active.some((branch) => branch.plotX === plot.x && branch.plotY === plot.y)).map((plot) => ({ plotId: `${plot.x},${plot.y}`, ...plot }));
    result.push({ cityId: host.id, name: host.name, npcKey: host.npcKey, plots, requiredGoods: [{ goodId: "GOOD_BREAD", qty: 3 }], expectedCycleProfit: 110, splitBps: { owner: 6000, host: 4000 } });
  }
  return { hosts: result };
}

function plotOrigins(cells: readonly { x: number; y: number }[]) {
  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  return cells.filter(({ x, y }) => !keys.has(`${x - 1},${y}`) && !keys.has(`${x},${y - 1}`) && keys.has(`${x + 1},${y}`) && keys.has(`${x},${y + 1}`) && keys.has(`${x + 1},${y + 1}`)).map(({ x, y }) => ({ x, y }));
}

export async function franchiseCommand(db: Database, limiter: RateLimiter, actor: Actor, request: FastifyRequest, reply: FastifyReply, now: Date, action: "request" | "supply" | "collect", id?: string): Promise<void> {
  const prepared = prepareCommand(limiter, actor, request, reply);
  const body = record(request.body);
  let hostId: string;
  if (action === "request") {
    if (typeof body.hostCityId !== "string" || typeof body.plotId !== "string" || body.businessDefinitionId !== "B-004" || Object.keys(body).length !== 3) throw new ApiError(400, "VALIDATION", "Invalid franchise request");
    if (!isUuid(body.hostCityId)) throw new ApiError(400, "VALIDATION", "Invalid host city ID");
    hostId = body.hostCityId;
  } else {
    if (id === undefined || !isUuid(id) || (action === "supply" ? (body.cycles !== 1 && body.cycles !== 2) || Object.keys(body).length !== 1 : Object.keys(body).length !== 0)) throw new ApiError(400, "VALIDATION", "Invalid franchise command");
    const [branch] = await db.select().from(franchises).where(and(eq(franchises.id, id), eq(franchises.ownerCity, actor.cityId)));
    if (branch === undefined) throw new ApiError(404, "NOT_FOUND", "Franchise not found");
    hostId = branch.hostCity;
  }
  const outcome = await runCommand(db, { actorId: actor.userId, sessionId: actor.sessionId, cityId: actor.cityId, cityIds: [actor.cityId, hostId], commandId: prepared.commandId, requestHash: sha256Hex(`${action}:${id ?? ""}:${prepared.requestHash}`), fromVersion: prepared.fromVersion, now, cityLevel: actor.level, apply: (ctx) => applyFranchise(ctx, actor.cityId, hostId, action, body, id) });
  reply.header("X-City-Version", String(outcome.body.cityVersion));
  if (outcome.replayed) reply.header("Idempotent-Replay", "true");
  void reply.status(outcome.statusCode).send(outcome.body);
}

async function applyFranchise(ctx: CommandContext, ownerId: string, hostId: string, action: "request" | "supply" | "collect", body: Record<string, unknown>, id?: string): Promise<CommandEffects> {
  if (action === "request") {
    const [host] = await ctx.tx.select().from(cities).where(and(eq(cities.id, hostId), eq(cities.isNpc, true)));
    if (host === undefined) throw new ApiError(404, "NOT_FOUND", "Host not found");
    const cells = await ctx.tx.select().from(cityCells).where(and(eq(cityCells.cityId, hostId), eq(cityCells.cellRole, "franchise_plot")));
    const plot = plotOrigins(cells).find((item) => `${item.x},${item.y}` === body.plotId);
    if (plot === undefined) throw new ApiError(422, "VALIDATION", "Plot not found");
    const active = await ctx.tx.select().from(franchises).where(inArray(franchises.state, ["REQUESTED", "ACCEPTED", "ACTIVE", "PAUSED"]));
    if (active.some((item) => item.ownerCity === ownerId && item.businessDefinitionId === body.businessDefinitionId)) throw new ApiError(422, "VALIDATION", "Brand already has an active branch");
    if (active.some((item) => item.hostCity === hostId && item.plotX === plot.x && item.plotY === plot.y)) throw new ApiError(422, "VALIDATION", "Plot is occupied");
    const franchiseId = randomUUID();
    const activeState = transitionFranchise(transitionFranchise(transitionFranchise("DRAFT", "REQUESTED"), "ACCEPTED"), "ACTIVE");
    await ctx.tx.insert(franchises).values({ id: franchiseId, ownerCity: ownerId, hostCity: hostId, businessDefinitionId: "B-004", hostPlot: { plotId: body.plotId }, plotX: plot.x, plotY: plot.y, state: activeState, isTrial: true, version: ctx.versionAfter });
    return { ledger: [], result: { franchiseId, state: "ACTIVE" }, telemetry: { name: "franchise_requested", payload: { franchiseId, hostCityId: hostId } } };
  }
  const [branch] = await ctx.tx.select().from(franchises).where(and(eq(franchises.id, id ?? ""), eq(franchises.ownerCity, ownerId), eq(franchises.hostCity, hostId)));
  if (branch === undefined || branch.state !== "ACTIVE") throw new ApiError(404, "NOT_FOUND", "Active franchise not found");
  if (action === "supply") {
    const cycles = body.cycles === 2 ? 2 : 1;
    const [balance] = await ctx.tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.cityId, ownerId), eq(inventoryBalances.goodId, "GOOD_BREAD")));
    if ((balance?.qty ?? 0) < cycles * 3) throw new ApiError(409, "INSUFFICIENT_GOODS", "Not enough bread");
    if (branch.stockCycles + cycles > 2) throw new ApiError(422, "VALIDATION", "Branch stock is full");
    const day = ctx.now.toISOString().slice(0, 10);
    const streak = nextSupplyStreak(branch.lastSupplyDay, branch.streakDays, ctx.now);
    const total = franchiseTotal(110, streak) * cycles;
    const split = franchiseSplit(franchiseTotal(110, streak));
    await ctx.tx.insert(franchiseShipments).values({ id: randomUUID(), franchiseId: branch.id, commandId: ctx.commandId, goods: [{ goodId: "GOOD_BREAD", qty: cycles * 3 }], totalValue: total, ownerAmount: split.owner * cycles, hostAmount: split.host * cycles, streakBonusBps: Math.min(1000, Math.max(0, streak - 1) * 200), state: transitionFranchiseShipment("SUPPLIED", "EARNING"), suppliedAt: ctx.now, earnCompletesAt: new Date(ctx.now.getTime() + 2_700_000) });
    await ctx.tx.update(franchises).set({ streakDays: streak, lastSupplyDay: day, stockCycles: branch.stockCycles + cycles, cycleStartedAt: ctx.now, version: ctx.versionAfter }).where(eq(franchises.id, branch.id));
    const [host] = await ctx.tx.select().from(cities).where(eq(cities.id, hostId));
    const hostNpcId = host?.npcKey === "dana_city" ? "NPC-CITY-DANA" : "NPC-CITY-AMIR";
    return { ledger: [{ resource: "GOOD_BREAD", delta: -3 * cycles, source: "franchise_supply", refType: "franchise", refId: branch.id }], result: { franchiseId: branch.id, cycles, streakDays: streak }, telemetry: { name: "franchise_supply", payload: { franchiseId: branch.id, hostCityId: hostId, hostNpcId } } };
  }
  const shipments = await ctx.tx.select().from(franchiseShipments).where(and(eq(franchiseShipments.franchiseId, branch.id), inArray(franchiseShipments.state, ["EARNING", "READY"])));
  const ready = shipments.filter((shipment) => shipment.state === "READY" || (shipment.earnCompletesAt !== null && shipment.earnCompletesAt <= ctx.now));
  const ownerAmount = ready.reduce((sum, shipment) => sum + shipment.ownerAmount, 0);
  const hostAmount = ready.reduce((sum, shipment) => sum + shipment.hostAmount, 0);
  const total = ready.reduce((sum, shipment) => sum + shipment.totalValue, 0);
  if (ready.length > 0) {
    const earningIds = ready.filter((shipment) => shipment.state === "EARNING").map((shipment) => shipment.id);
    if (earningIds.length > 0) await ctx.tx.update(franchiseShipments).set({ state: transitionFranchiseShipment("EARNING", "READY") }).where(inArray(franchiseShipments.id, earningIds));
    await ctx.tx.update(franchiseShipments).set({ state: transitionFranchiseShipment("READY", "SETTLED"), settledAt: ctx.now }).where(inArray(franchiseShipments.id, ready.map((shipment) => shipment.id)));
    const cycles = ready.reduce((sum, shipment) => sum + shipment.totalValue / franchiseTotal(110, Math.round(shipment.streakBonusBps / 200) + 1), 0);
    await ctx.tx.update(franchises).set({ stockCycles: Math.max(0, branch.stockCycles - cycles), version: ctx.versionAfter }).where(eq(franchises.id, branch.id));
    const [host] = await ctx.tx.select().from(cities).where(eq(cities.id, hostId));
    if (host === undefined) throw new Error("host missing");
    await ctx.tx.update(cities).set({ coins: Number(host.coins) + hostAmount, version: sql`${cities.version} + 1`, updatedAt: ctx.now }).where(eq(cities.id, hostId));
    await ctx.tx.insert(inventoryLedger).values({ cityId: hostId, resource: "COINS", delta: hostAmount, balanceAfter: Number(host.coins) + hostAmount, source: "franchise_collect", commandId: ctx.commandId, refType: "franchise", refId: branch.id });
  }
  return { ledger: ownerAmount ? [{ resource: "COINS", delta: ownerAmount, source: "franchise_collect", refType: "franchise", refId: branch.id }] : [], result: { franchiseId: branch.id, ownerAmount, hostAmount, total }, telemetry: { name: "franchise_collect", payload: { franchiseId: branch.id, total } } };
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ApiError(400, "VALIDATION", "Invalid body");
  return Object.fromEntries(Object.entries(value));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
