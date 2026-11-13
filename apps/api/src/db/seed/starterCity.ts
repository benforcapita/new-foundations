import { randomUUID } from "node:crypto";
import {
  CONTENT_VERSION,
  STARTER_MAP,
  agricultureById,
  buildingById,
  goodById,
  orderReward,
  warehouseCapacity,
} from "@nf/shared";
import type { Database } from "../client";
import { buildingCells, buildingInstances, cities, cityCells, inventoryBalances, inventoryLedger, orderInstances, quests, sessions, users } from "../schema";
import { randomSecret, sha256Hex } from "../../crypto";

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
  readonly pendingOutput: { readonly goodId: string; readonly qty: number } | null;
};

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
    await tx.insert(sessions).values({
      userId,
      tokenHash: sha256Hex(token),
    });
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
      id: `${cityId}:town_hall`,
      definitionId: "B-009",
      x: STARTER_MAP.townHall.x,
      y: STARTER_MAP.townHall.y,
      width: hall.footprint.width,
      height: hall.footprint.height,
      state: "ACTIVE",
      pendingOutput: null,
    },
    {
      id: `${cityId}:grocery`,
      definitionId: "B-004",
      x: 9,
      y: 4,
      width: grocery.footprint.width,
      height: grocery.footprint.height,
      state: "NEEDS_SUPPLY",
      pendingOutput: null,
    },
    {
      id: `${cityId}:wheat_0`,
      definitionId: "AG-001",
      x: 0,
      y: 0,
      width: wheat.footprint.width,
      height: wheat.footprint.height,
      state: "READY_TO_COLLECT",
      pendingOutput: { goodId: wheat.outputGoodId, qty: wheat.outputQty },
    },
    {
      id: `${cityId}:wheat_1`,
      definitionId: "AG-001",
      x: 2,
      y: 0,
      width: wheat.footprint.width,
      height: wheat.footprint.height,
      state: "READY_TO_COLLECT",
      pendingOutput: { goodId: wheat.outputGoodId, qty: wheat.outputQty },
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
    version: 0,
    contentVersion: CONTENT_VERSION,
    population: 0,
    populationCap: hall.populationCap,
    warehouseTier: 0,
    warehouseCap,
    isNpc: false,
    catalogId: null,
    tutorialState: { step: "place_house", guideNpcId: "NPC-MIA" },
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
      version: 0,
      pendingOutput: placement.pendingOutput,
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

  await tx.insert(inventoryBalances).values({ cityId, goodId: "GOOD_BREAD", qty: STARTER_BREAD });
  await tx.insert(inventoryLedger).values({
    cityId,
    goodId: "GOOD_BREAD",
    delta: STARTER_BREAD,
    source: "tutorial_grant",
  });

  const bread = goodById("GOOD_BREAD");
  const wheatGood = goodById("GOOD_WHEAT");
  const breadReward = orderReward([{ qty: 3, value: bread.value }], "easy");
  const wheatReward = orderReward([{ qty: 3, value: wheatGood.value }], "easy");
  await tx.insert(orderInstances).values([
    {
      id: `${cityId}:order:0`,
      cityId,
      slot: 0,
      templateId: "ORD-T-001",
      requirements: [{ goodId: "GOOD_BREAD", qty: 3 }],
      status: "OPEN" as const,
      difficulty: "easy" as const,
      solvable: true,
      rewardCoins: breadReward.coins,
      rewardXp: breadReward.xp,
      civicStars: breadReward.civicStars,
      version: 0,
    },
    {
      id: `${cityId}:order:1`,
      cityId,
      slot: 1,
      templateId: "ORD-EASY-BREAD",
      requirements: [{ goodId: "GOOD_BREAD", qty: 3 }],
      status: "OPEN" as const,
      difficulty: "easy" as const,
      solvable: true,
      rewardCoins: breadReward.coins,
      rewardXp: breadReward.xp,
      civicStars: breadReward.civicStars,
      version: 0,
    },
    {
      id: `${cityId}:order:2`,
      cityId,
      slot: 2,
      templateId: "ORD-EASY-WHEAT",
      requirements: [{ goodId: "GOOD_WHEAT", qty: 3 }],
      status: "OPEN" as const,
      difficulty: "easy" as const,
      solvable: true,
      rewardCoins: wheatReward.coins,
      rewardXp: wheatReward.xp,
      civicStars: wheatReward.civicStars,
      version: 0,
    },
  ]);

  await tx.insert(quests).values([
    {
      cityId,
      questId: "quest_tutorial_house",
      status: "ACTIVE",
      stepIndex: 0,
      stepState: { "0": 0 },
      version: 0,
    },
    {
      cityId,
      questId: "quest_early_bakery_01",
      status: "ACTIVE",
      stepIndex: 0,
      stepState: { "0": 0, "1": 0 },
      version: 0,
    },
    {
      cityId,
      questId: "quest_flower_street",
      status: "ACTIVE",
      stepIndex: 0,
      stepState: { "0": 0 },
      version: 0,
    },
  ]);
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
