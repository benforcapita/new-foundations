import { randomUUID } from "node:crypto";
import {
  CONTENT_VERSION,
  ORDER_TEMPLATES,
  QUESTS,
  STARTER_MAP,
  agricultureById,
  buildingById,
  goodById,
  orderReward,
  warehouseCapacity,
  type OrderTemplate,
  type QuestDefinition,
} from "@nf/shared";
import type { Database } from "../client";
import { buildingCells, buildingInstances, cities, cityCells, inventoryBalances, inventoryLedger, orderInstances, quests, sessions, telemetryEvents, users } from "../schema";
import { randomSecret, sha256Bytes, sha256Hex } from "../../crypto";

const STARTER_COINS = 750;
const STARTER_BREAD = 3;
const PLACEABLE_TERRAIN = new Set(["grass", "grass_flowers", "plaza"]);

export type IssuedSession = {
  readonly token: string;
  readonly userId: string;
  readonly cityId: string;
  readonly isNew: true;
  readonly recoveryCode: string;
};

type Placement = {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly state: string;
  readonly outputReady: { readonly goodId: string; readonly qty: number } | Record<string, never>;
};

const STARTER_CHUNKS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

type StarterTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function createGuest(db: Database): Promise<IssuedSession> {
  const token = randomSecret();
  const recoveryCode = randomSecret();
  const userId = randomUUID();
  const cityId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      locale: "en",
      settings: {},
      recoveryCodeHash: sha256Hex(recoveryCode),
    });
    await insertStarterCity(tx, userId, cityId);
    const [session] = await tx.insert(sessions).values({
      userId,
      tokenHash: sha256Bytes(token),
      lastSeenAt: new Date(),
    }).returning({ id: sessions.id });
    await tx.insert(telemetryEvents).values({ playerId: userId, sessionId: session?.id, name: "tutorial_started", payload: {}, contentVersion: CONTENT_VERSION, cityLevel: 1 });
  });
  return { token, userId, cityId, isNew: true, recoveryCode };
}

async function insertStarterCity(tx: StarterTx, userId: string, cityId: string): Promise<void> {
  const hall = buildingById("B-009");
  const grocery = buildingById("B-004");
  const wheat = agricultureById("AG-001");
  if (hall.category !== "civic") {
    throw new Error("B-009 must be a civic building");
  }
  const warehouseCap = warehouseCapacity(0);
  const placements: readonly Placement[] = [
    {
      id: randomUUID(),
      definitionId: "B-009",
      x: STARTER_MAP.townHall.x,
      y: STARTER_MAP.townHall.y,
      width: hall.footprint.width,
      height: hall.footprint.height,
      state: "ACTIVE",
      outputReady: {},
    },
    {
      id: randomUUID(),
      definitionId: "B-004",
      x: 9,
      y: 4,
      width: grocery.footprint.width,
      height: grocery.footprint.height,
      state: "NEEDS_SUPPLY",
      outputReady: {},
    },
    {
      id: randomUUID(),
      definitionId: "AG-001",
      x: 0,
      y: 0,
      width: wheat.footprint.width,
      height: wheat.footprint.height,
      state: "READY_TO_COLLECT",
      outputReady: { goodId: wheat.outputGoodId, qty: wheat.outputQty },
    },
    {
      id: randomUUID(),
      definitionId: "AG-001",
      x: 2,
      y: 0,
      width: wheat.footprint.width,
      height: wheat.footprint.height,
      state: "READY_TO_COLLECT",
      outputReady: { goodId: wheat.outputGoodId, qty: wheat.outputQty },
    },
  ];
  assertPlacements(placements);

  await tx.insert(cities).values({
    id: cityId,
    ownerId: userId,
    name: "New Foundations",
    level: 1,
    xp: 0,
    coins: STARTER_COINS,
    gems: 0,
    civicStars: 0,
    version: 1,
    contentVersion: CONTENT_VERSION,
    population: 0,
    populationCap: hall.populationCap,
    warehouseTier: 0,
    warehouseCap,
    isNpc: false,
    npcKey: null,
    tutorialState: { step: "place_house", guideNpcId: "NPC-MIA" },
    unlockedBounds: STARTER_CHUNKS,
    collectPriority: "QUEST_FIRST",
  });

  const cells: {
    cityId: string;
    x: number;
    y: number;
    terrainId: string;
    ownerClaimed: boolean;
    cellRole: "terrain";
  }[] = [];
  for (let y = 0; y < STARTER_MAP.rows.length; y += 1) {
    const row = STARTER_MAP.rows[y];
    if (row === undefined) {
      throw new Error(`starter map is missing row ${y}`);
    }
    for (let x = 0; x < row.length; x += 1) {
      const terrainId = row[x];
      if (terrainId === undefined) {
        throw new Error(`starter map is missing cell ${x},${y}`);
      }
      cells.push({ cityId, x, y, terrainId, ownerClaimed: true, cellRole: "terrain" });
    }
  }
  await tx.insert(cityCells).values(cells);
  await tx.insert(buildingInstances).values(
    placements.map((placement) => ({
      id: placement.id,
      cityId,
      definitionId: placement.definitionId,
      x: placement.x,
      y: placement.y,
      rotation: 0,
      state: placement.state,
      level: 1,
      version: 1,
      outputReady: placement.outputReady,
    })),
  );
  await tx.insert(buildingCells).values(
    placements.flatMap((placement) => {
      const covered: { cityId: string; x: number; y: number; buildingId: string }[] = [];
      for (let dy = 0; dy < placement.height; dy += 1) {
        for (let dx = 0; dx < placement.width; dx += 1) {
          covered.push({
            cityId,
            x: placement.x + dx,
            y: placement.y + dy,
            buildingId: placement.id,
          });
        }
      }
      return covered;
    }),
  );

  await tx.insert(inventoryBalances).values({ cityId, goodId: "GOOD_BREAD", qty: STARTER_BREAD, version: 1 });
  await tx.insert(inventoryLedger).values([
    {
      cityId,
      resource: "COINS",
      delta: STARTER_COINS,
      balanceAfter: STARTER_COINS,
      source: "tutorial_grant",
    },
    {
      cityId,
      resource: "GOOD_BREAD",
      delta: STARTER_BREAD,
      balanceAfter: STARTER_BREAD,
      source: "tutorial_grant",
    },
  ]);

  const seedBread = orderTemplate("ORD-T-001");
  const easyBread = orderTemplate("ORD-EASY-BREAD");
  // The catalog has no second level-1 easy card. Recovery pays a fixed 60 coins
  // and only replaces the easy slot below 180 coins, so this tutorial wheat card
  // keeps the easy coefficient instead.
  const wheatGood = goodById("GOOD_WHEAT");
  const wheatQty = 3;
  const wheatReward = orderReward([{ qty: wheatQty, value: wheatGood.value }], "easy");
  await tx.insert(orderInstances).values([
    catalogOrder(cityId, 0, seedBread),
    catalogOrder(cityId, 1, easyBread),
    {
      id: randomUUID(),
      cityId,
      slot: 2,
      templateId: "ORD-EASY-WHEAT",
      requirements: [{ goodId: "GOOD_WHEAT", qty: wheatQty }],
      status: "OPEN" as const,
      difficulty: "easy" as const,
      solvable: true,
      rewardCoins: wheatReward.coins,
      rewardXp: wheatReward.xp,
      civicStars: wheatReward.civicStars,
      version: 1,
    },
  ]);

  await tx.insert(quests).values(
    seededQuests().map((quest) => ({
      cityId,
      questId: quest.id,
      periodKey: "-",
      track: quest.track,
      status: "ACTIVE" as const,
      stepIndex: 0,
      stepState: initialStepState(quest.steps),
      version: 1,
    })),
  );
}

function orderTemplate(id: string): OrderTemplate {
  const template = ORDER_TEMPLATES.find((item) => item.id === id);
  if (template === undefined) {
    throw new Error(`order template ${id} is not in the catalog`);
  }
  return template;
}

function catalogOrder(cityId: string, slot: number, template: OrderTemplate) {
  return {
    id: randomUUID(),
    cityId,
    slot,
    templateId: template.id,
    requirements: template.requirements.map((line) => ({ goodId: line.goodId, qty: line.qty })),
    status: "OPEN" as const,
    difficulty: template.difficulty,
    solvable: true,
    rewardCoins: template.reward.coins,
    rewardXp: template.reward.xp,
    civicStars: 1,
    version: 1,
  };
}

function seededQuests(): readonly QuestDefinition[] {
  const root = QUESTS.find((quest) => quest.id === "quest_tutorial_house");
  if (root === undefined || root.track !== "story" || root.prerequisites.length !== 0) {
    throw new Error("quest_tutorial_house must be the root story quest");
  }
  return [root];
}

function initialStepState(steps: readonly unknown[]): Record<string, number> {
  const state: Record<string, number> = {};
  for (let index = 0; index < steps.length; index += 1) {
    state[String(index)] = 0;
  }
  return state;
}

function assertPlacements(placements: readonly Placement[]): void {
  const occupied = new Set<string>();
  for (const placement of placements) {
    for (let dy = 0; dy < placement.height; dy += 1) {
      for (let dx = 0; dx < placement.width; dx += 1) {
        const x = placement.x + dx;
        const y = placement.y + dy;
        const key = `${x},${y}`;
        if (occupied.has(key)) {
          throw new Error(`starter placement ${placement.definitionId} overlaps ${key}`);
        }
        occupied.add(key);
        const terrain = STARTER_MAP.rows[y]?.[x];
        if (terrain === undefined || !PLACEABLE_TERRAIN.has(terrain)) {
          throw new Error(`starter placement ${placement.definitionId} is not on buildable terrain at ${key}`);
        }
      }
    }
  }
}
