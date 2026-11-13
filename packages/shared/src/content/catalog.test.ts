import { expect, test } from "vitest";
import seed from "../../../../assets/content_seed.json" with { type: "json" };
import {
  AGRICULTURE,
  BUILDINGS,
  CONTENT_VERSION,
  DECORATIONS,
  GOODS,
  LEVELS,
  NPCS,
  NPC_CITIES,
  ORDER_GENERATOR,
  ORDER_TEMPLATES,
  QUESTS,
  RECIPES,
  RECOVERY_ORDER,
  ROAD,
  STARTER_MAP,
  agricultureById,
  buildingById,
  commercialInputCapacity,
  generateOrderBoard,
  goodById,
  recipeById,
} from "./index";

test("content version is the NF-2 catalog revision", () => {
  expect(CONTENT_VERSION).toBe(1);
});

test("buildings B-001 through B-012 match the seed catalog", () => {
  expect(BUILDINGS.map((building) => building.id)).toEqual([
    "B-001",
    "B-002",
    "B-003",
    "B-004",
    "B-005",
    "B-006",
    "B-007",
    "B-008",
    "B-009",
    "B-010",
    "B-011",
    "B-012",
  ]);

  expect(buildingById("B-001")).toMatchObject({
    nameKey: "building.cottage.name",
    category: "residential",
    footprint: { width: 2, height: 2 },
    cost: { coins: 180 },
    buildSeconds: 30,
    firstFree: true,
    firstInstant: true,
    unlockLevel: 1,
    population: 8,
    rent: { coins: 32, seconds: 480 },
    assetId: "bld_res_cottage",
  });
  expect(buildingById("B-002")).toMatchObject({
    nameKey: "building.rowhouse.name",
    category: "residential",
    footprint: { width: 2, height: 2 },
    cost: { coins: 430 },
    buildSeconds: 180,
    firstFree: false,
    unlockLevel: 4,
    population: 18,
    rent: { coins: 60, seconds: 900 },
    assetId: "bld_res_rowhouse",
  });
  expect(buildingById("B-003")).toMatchObject({
    nameKey: "building.apartments.name",
    category: "residential",
    footprint: { width: 3, height: 3 },
    cost: { coins: 1750 },
    buildSeconds: 2400,
    unlockLevel: 9,
    population: 50,
    rent: { coins: 140, seconds: 1800 },
    assetId: "bld_res_apartments",
  });
  expect(buildingById("B-004")).toMatchObject({
    nameKey: "building.grocery.name",
    category: "commercial",
    footprint: { width: 2, height: 2 },
    cost: { coins: 500 },
    buildSeconds: 120,
    firstFree: false,
    firstInstant: true,
    unlockLevel: 1,
    stockInput: [{ goodId: "GOOD_BREAD", qty: 3 }],
    salesCycleSeconds: 600,
    coinYield: 110,
    stockedCycles: 3,
    assetId: "bld_com_grocery",
  });
  const grocery = buildingById("B-004");
  expect(grocery.category).toBe("commercial");
  if (grocery.category === "commercial") {
    expect(commercialInputCapacity(grocery)).toBe(9);
  }
  expect(buildingById("B-005")).toMatchObject({
    category: "commercial",
    footprint: { width: 2, height: 2 },
    cost: { coins: 980 },
    buildSeconds: 720,
    unlockLevel: 5,
    stockInput: [
      { goodId: "GOOD_CHEESE", qty: 2 },
      { goodId: "GOOD_MILK", qty: 2 },
    ],
    salesCycleSeconds: 1200,
    coinYield: 185,
    stockedCycles: 3,
    assetId: "bld_com_cafe",
  });
  expect(buildingById("B-006")).toMatchObject({
    category: "commercial",
    footprint: { width: 2, height: 2 },
    cost: { coins: 1800 },
    buildSeconds: 2100,
    unlockLevel: 10,
    stockInput: [{ goodId: "GOOD_BOOKS", qty: 6 }],
    salesCycleSeconds: 2100,
    coinYield: 290,
    stockedCycles: 3,
    assetId: "bld_com_bookstore",
  });
  expect(buildingById("B-007")).toMatchObject({
    nameKey: "building.bakery.name",
    category: "production",
    footprint: { width: 2, height: 2 },
    cost: { coins: 350 },
    buildSeconds: 180,
    firstFree: true,
    firstInstant: true,
    unlockLevel: 1,
    produces: ["GOOD_BREAD", "GOOD_CHEESE"],
    assetId: "bld_prod_bakery",
  });
  expect(buildingById("B-008")).toMatchObject({
    category: "production",
    footprint: { width: 3, height: 3 },
    cost: { coins: 860 },
    buildSeconds: 600,
    unlockLevel: 4,
    produces: ["GOOD_PLANKS", "GOOD_PAINT", "GOOD_BOOKS"],
    assetId: "bld_prod_carpenter",
  });
  expect(buildingById("B-009")).toMatchObject({
    nameKey: "building.townhall.name",
    category: "civic",
    footprint: { width: 4, height: 4 },
    cost: { coins: 0 },
    prebuilt: true,
    unlockLevel: 1,
    populationCap: 50,
    npcId: "NPC-MIA",
    assetId: "bld_civic_townhall",
  });
  expect(buildingById("B-010")).toMatchObject({
    category: "civic",
    footprint: { width: 3, height: 3 },
    cost: { coins: 1250 },
    buildSeconds: 1800,
    unlockLevel: 6,
    populationCap: 75,
    assetId: "bld_civic_school",
  });
  expect(buildingById("B-011")).toMatchObject({
    category: "logistics",
    footprint: { width: 4, height: 3 },
    cost: { coins: 900 },
    buildSeconds: 480,
    unlockLevel: 3,
    wagonCount: 3,
    npcId: "NPC-TOM",
    assetId: "bld_log_trainstation",
  });
  expect(buildingById("B-012")).toMatchObject({
    category: "decoration",
    footprint: { width: 3, height: 3 },
    cost: { coins: 600 },
    buildSeconds: 300,
    unlockLevel: 4,
    boost: 0.03,
    boostRadius: 3,
    assetId: "bld_deco_park",
  });
});

test("seeded building keys stay aligned with content_seed.json", () => {
  for (const item of seed.items) {
    const building = buildingById(item.id as "B-001");
    expect(building.nameKey).toBe(item.nameKey);
    expect(building.category).toBe(item.category);
    expect(building.footprint).toEqual(item.footprint);
    expect(building.cost.coins).toBe(item.cost.coins);
    expect(building.assetId).toBe(item.assetId);
    if ("buildSeconds" in item && item.buildSeconds !== undefined) {
      expect(building.buildSeconds).toBe(item.buildSeconds);
    }
    if (item.category === "residential" && "population" in item && "rent" in item) {
      expect(building).toMatchObject({ population: item.population, rent: item.rent });
    }
    if (item.category === "commercial" && "stockInput" in item) {
      expect(building.category).toBe("commercial");
      if (building.category === "commercial") {
        expect(Object.fromEntries(building.stockInput.map((line) => [line.goodId, line.qty]))).toEqual(
          item.stockInput,
        );
        expect(building.salesCycleSeconds).toBe(item.salesCycleSeconds);
        expect(building.coinYield).toBe(item.coinYield);
      }
    }
    if (item.category === "civic" && "populationCap" in item) {
      expect(building).toMatchObject({ populationCap: item.populationCap });
    }
    if (item.category === "production" && "recipes" in item && item.recipes !== undefined) {
      const first = item.recipes[0];
      if (first === undefined) {
        throw new Error("seed bakery recipe is missing");
      }
      const bread = recipeById("RCP-BREAD");
      expect(bread.seconds).toBe(first.seconds);
      expect(bread.inputs).toEqual([{ goodId: "GOOD_WHEAT", qty: 2 }]);
      expect(bread.outputs).toEqual([{ goodId: "GOOD_BREAD", qty: 3 }]);
    }
  }
});

test("agriculture plots AG-001 through AG-004 are instant and auto-replant", () => {
  expect(AGRICULTURE.map((plot) => plot.id)).toEqual(["AG-001", "AG-002", "AG-003", "AG-004"]);
  for (const plot of AGRICULTURE) {
    expect(plot.footprint).toEqual({ width: 2, height: 2 });
    expect(plot.buildSeconds).toBe(0);
    expect(plot.autoReplant).toBe(true);
    expect(plot.outputQty).toBe(3);
    expect(plot.groundTileCount).toBe(4);
  }
  expect(agricultureById("AG-001")).toMatchObject({
    groundAssetId: "tile_grass_flowers",
    overlayAssetId: "ico_goods_wheat",
    outputGoodId: "GOOD_WHEAT",
    cycleSeconds: 180,
    cost: { coins: 20 },
    unlockLevel: 1,
  });
  expect(agricultureById("AG-001").propAssetId).toBeUndefined();
  expect(agricultureById("AG-002")).toMatchObject({
    groundAssetId: "tile_grass",
    propAssetId: "deco_tree_oak",
    overlayAssetId: "ico_goods_wood",
    outputGoodId: "GOOD_TIMBER",
    cycleSeconds: 300,
    cost: { coins: 40 },
    unlockLevel: 4,
  });
  expect(agricultureById("AG-003")).toMatchObject({
    groundAssetId: "tile_grass",
    propAssetId: "deco_flower_patch",
    overlayAssetId: "ico_goods_milk",
    outputGoodId: "GOOD_MILK",
    cycleSeconds: 480,
    cost: { coins: 60 },
    unlockLevel: 5,
  });
  expect(agricultureById("AG-004")).toMatchObject({
    groundAssetId: "tile_grass_flowers",
    propAssetId: "deco_flower_patch",
    overlayAssetId: "ico_goods_flowers",
    outputGoodId: "GOOD_FLOWERS",
    cycleSeconds: 300,
    cost: { coins: 40 },
    unlockLevel: 10,
  });
});

test("nine goods each take one storage unit", () => {
  expect(GOODS.map((good) => good.id)).toEqual([
    "GOOD_WHEAT",
    "GOOD_TIMBER",
    "GOOD_MILK",
    "GOOD_FLOWERS",
    "GOOD_BREAD",
    "GOOD_PLANKS",
    "GOOD_CHEESE",
    "GOOD_PAINT",
    "GOOD_BOOKS",
  ]);
  expect(GOODS.every((good) => good.storageUnits === 1)).toBe(true);
  expect(goodById("GOOD_WHEAT")).toMatchObject({ tier: "raw", value: 15, unlockLevel: 1, iconAssetId: "ico_goods_wheat" });
  expect(goodById("GOOD_TIMBER")).toMatchObject({ tier: "raw", value: 20, unlockLevel: 4, iconAssetId: "ico_goods_wood" });
  expect(goodById("GOOD_MILK")).toMatchObject({ tier: "raw", value: 25, unlockLevel: 5, iconAssetId: "ico_goods_milk" });
  expect(goodById("GOOD_FLOWERS")).toMatchObject({ tier: "raw", value: 20, unlockLevel: 10, iconAssetId: "ico_goods_flowers" });
  expect(goodById("GOOD_BREAD")).toMatchObject({ tier: "finished", value: 60, unlockLevel: 1 });
  expect(goodById("GOOD_PLANKS")).toMatchObject({ tier: "finished", value: 130, unlockLevel: 4 });
  expect(goodById("GOOD_CHEESE")).toMatchObject({ tier: "finished", value: 90, unlockLevel: 5 });
  expect(goodById("GOOD_PAINT")).toMatchObject({ tier: "advanced", value: 80, unlockLevel: 10 });
  expect(goodById("GOOD_BOOKS")).toMatchObject({ tier: "advanced", value: 220, unlockLevel: 10 });
});

test("recipes convert the nine-good production chain", () => {
  expect(RECIPES.map((recipe) => recipe.id)).toEqual([
    "RCP-BREAD",
    "RCP-PLANKS",
    "RCP-CHEESE",
    "RCP-PAINT",
    "RCP-BOOKS",
  ]);
  expect(recipeById("RCP-BREAD")).toMatchObject({
    buildingId: "B-007",
    unlockLevel: 1,
    seconds: 360,
    inputs: [{ goodId: "GOOD_WHEAT", qty: 2 }],
    outputs: [{ goodId: "GOOD_BREAD", qty: 3 }],
  });
  expect(recipeById("RCP-PLANKS")).toMatchObject({
    buildingId: "B-008",
    unlockLevel: 4,
    seconds: 900,
    inputs: [{ goodId: "GOOD_TIMBER", qty: 3 }],
    outputs: [{ goodId: "GOOD_PLANKS", qty: 2 }],
  });
  expect(recipeById("RCP-CHEESE")).toMatchObject({
    buildingId: "B-007",
    unlockLevel: 5,
    seconds: 720,
    inputs: [{ goodId: "GOOD_MILK", qty: 2 }],
    outputs: [{ goodId: "GOOD_CHEESE", qty: 2 }],
  });
  expect(recipeById("RCP-PAINT")).toMatchObject({
    buildingId: "B-008",
    unlockLevel: 10,
    seconds: 1200,
    inputs: [{ goodId: "GOOD_FLOWERS", qty: 2 }],
    outputs: [{ goodId: "GOOD_PAINT", qty: 2 }],
  });
  expect(recipeById("RCP-BOOKS")).toMatchObject({
    buildingId: "B-008",
    unlockLevel: 10,
    seconds: 1800,
    inputs: [
      { goodId: "GOOD_TIMBER", qty: 2 },
      { goodId: "GOOD_PAINT", qty: 1 },
    ],
    outputs: [{ goodId: "GOOD_BOOKS", qty: 2 }],
  });
});

test("decorations D-001 through D-007 and landmark LM-001 use tunable boosts", () => {
  expect(DECORATIONS.map((decoration) => decoration.id)).toEqual([
    "D-001",
    "D-002",
    "D-003",
    "D-004",
    "D-005",
    "D-006",
    "D-007",
    "LM-001",
  ]);
  const streets = DECORATIONS.filter((decoration) => decoration.id.startsWith("D-"));
  expect(streets.map((decoration) => decoration.assetId)).toEqual([
    "deco_tree_oak",
    "deco_tree_spring",
    "deco_bench",
    "deco_lamp",
    "deco_planter",
    "deco_fountain",
    "deco_flower_patch",
  ]);
  for (const decoration of streets) {
    expect(decoration.boost).toBe(0.01);
    expect(decoration.radius).toBe(2);
    expect(decoration.unlockLevel).toBe(4);
    expect(decoration.footprint).toEqual({ width: 1, height: 1 });
  }
  expect(DECORATIONS.find((decoration) => decoration.id === "LM-001")).toMatchObject({
    nameKey: "decoration.landmark.name",
    footprint: { width: 4, height: 4 },
    unlockLevel: 15,
    boost: 0.03,
    radius: 3,
    contentPhase: "p1",
    parts: [
      { assetId: "tile_plaza", role: "ground", count: 16 },
      { assetId: "deco_fountain", role: "centre", count: 1 },
      { assetId: "deco_lamp", role: "lamp", count: 4 },
    ],
  });
});

test("R-001 is a 1x1 road with the five autotile assets", () => {
  expect(ROAD).toMatchObject({
    id: "R-001",
    footprint: { width: 1, height: 1 },
    tiles: {
      straightNs: "tile_road_straight_ns",
      straightEw: "tile_road_straight_ew",
      corner: "tile_road_corner",
      t: "tile_road_t",
      cross: "tile_road_cross",
    },
  });
});

test("levels L1 through L15 carry the cumulative XP thresholds", () => {
  expect(LEVELS.map((level) => level.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  expect(LEVELS.map((level) => level.xpToNext)).toEqual([
    50, 120, 220, 350, 500, 700, 950, 1250, 1600, 2000, 2450, 2950, 3500, 4100, null,
  ]);
  expect(LEVELS[14]?.unlocks).toContain("LM-001");
  expect(LEVELS[0]?.unlocks).toEqual(expect.arrayContaining(["B-001", "B-004", "B-007", "AG-001", "R-001", "order-board"]));
  expect(LEVELS[2]?.unlocks).toEqual(expect.arrayContaining(["B-011", "NPC-TOM"]));
  expect(LEVELS[3]?.unlocks).toEqual(
    expect.arrayContaining(["B-002", "B-008", "B-012", "AG-002", "D-001", "D-007", "NPC-AMIR"]),
  );
  expect(LEVELS[4]?.unlocks).toEqual(expect.arrayContaining(["medium-orders", "queue-slot-3", "GOOD_CHEESE"]));
  expect(LEVELS[8]?.unlocks).toContain("B-003");
  expect(LEVELS[9]?.unlocks).toEqual(expect.arrayContaining(["B-006", "AG-004", "GOOD_BOOKS"]));
  expect(LEVELS[9]?.unlocks).not.toContain("human-franchises");
  expect(LEVELS[10]?.unlocks).toEqual(["warehouse-tier-4", "warehouse-tier-5"]);
  expect(LEVELS[11]?.unlocks).not.toContain("harbor");
  expect(LEVELS[11]?.reward).toEqual({ coins: 500, civicStars: 1 });
  expect(LEVELS[12]?.unlocks).toEqual(["specialized-order-weight"]);
  expect(LEVELS[13]?.unlocks).toEqual(["building-level-3"]);
});

test("quests, orders, and NPCs cover the starter loop", () => {
  expect(QUESTS.map((quest) => quest.id)).toEqual([
    "quest_tutorial_house",
    "quest_tutorial_grocery",
    "quest_tutorial_bakery",
    "quest_early_bakery_01",
    "quest_flower_street",
    "quest_dana_franchise",
  ]);
  expect(QUESTS.every((quest) => quest.canExpire === false && quest.canPurchaseSkip === false)).toBe(true);
  const bakery = QUESTS.find((quest) => quest.id === "quest_early_bakery_01");
  expect(bakery).toMatchObject({
    nameKey: "quest.early_bakery.title",
    reward: { coins: 150, xp: 25 },
    steps: [
      { event: "building_placed", filter: { building_definition_id: "B-007" }, amount: 1 },
      { event: "goods_produced", filter: { good_id: "GOOD_BREAD" }, amount: 3 },
    ],
  });
  expect(QUESTS.find((quest) => quest.id === "quest_flower_street")).toMatchObject({
    nameKey: "quest.flower_street.title",
    reward: { coins: 300, xp: 60, decorationId: "D-003" },
    steps: [
      { event: "building_placed", amount: 1 },
      { event: "goods_produced", filter: { good_id: "GOOD_WHEAT" }, amount: 3 },
      { event: "goods_produced", filter: { good_id: "GOOD_BREAD" }, amount: 3 },
      { event: "business_supplied", amount: 1 },
      { event: "coins_collected", amount: 1 },
      { event: "franchise_supply", amount: 1 },
      { event: "decoration_placed", amount: 1 },
    ],
  });
  expect(QUESTS.find((quest) => quest.id === "quest_dana_franchise")?.reward).toEqual({ coins: 100, xp: 25 });

  expect(ORDER_TEMPLATES.find((template) => template.id === "ORD-T-001")).toMatchObject({
    requirements: [{ goodId: "GOOD_BREAD", qty: 3 }],
    reward: { coins: 180, xp: 12 },
  });
  expect(ORDER_TEMPLATES.find((template) => template.id === "ORD-T-002")).toMatchObject({
    requirements: [
      { goodId: "GOOD_PLANKS", qty: 2 },
      { goodId: "GOOD_BREAD", qty: 1 },
    ],
    reward: { coins: 325, xp: 25 },
  });

  expect(ORDER_GENERATOR).toMatchObject({
    boardSize: 3,
    slotDifficulties: ["easy", "medium", "specialized"],
    freeRerollSeconds: 900,
    requireSolvable: true,
  });
  expect(RECOVERY_ORDER).toMatchObject({
    coinThreshold: 180,
    requirements: [{ goodId: "GOOD_WHEAT", qty: 3 }],
    coins: 60,
    xp: 5,
  });
  expect(ORDER_TEMPLATES.map((template) => template.difficulty)).toEqual(
    expect.arrayContaining(["easy", "medium", "specialized"]),
  );

  expect(NPCS.map((npc) => npc.id)).toEqual(["NPC-MIA", "NPC-DANA", "NPC-TOM", "NPC-AMIR"]);
  expect(NPC_CITIES.map((city) => city.id)).toEqual(["NPC-CITY-DANA", "NPC-CITY-AMIR"]);
  expect(NPC_CITIES.find((city) => city.id === "NPC-CITY-DANA")).toMatchObject({
    nameKey: "npc.dana.city.name",
    npcId: "NPC-DANA",
    acceptsFranchises: true,
  });
  expect(NPC_CITIES.find((city) => city.id === "NPC-CITY-AMIR")).toMatchObject({
    nameKey: "npc.amir.garden.name",
    npcId: "NPC-AMIR",
  });
});

test("the order generator fills the board and inserts the recovery order", () => {
  const unlocked = GOODS.filter((good) => good.unlockLevel <= 10).map((good) => good.id);
  const early = generateOrderBoard({
    level: 1,
    coins: 750,
    unlockedGoodIds: unlocked,
    hasSolvableOpenOrder: true,
  });
  expect(early.map((order) => order.difficulty)).toEqual(["easy"]);
  expect(early[0]?.recovery).toBe(false);
  expect(early[0]?.requirements).toEqual([{ goodId: "GOOD_BREAD", qty: 3 }]);

  const broke = generateOrderBoard({
    level: 1,
    coins: 179,
    unlockedGoodIds: unlocked,
    hasSolvableOpenOrder: false,
  });
  expect(broke[0]).toMatchObject({
    recovery: true,
    requirements: [{ goodId: "GOOD_WHEAT", qty: 3 }],
    coins: 60,
    xp: 5,
  });

  const board = generateOrderBoard({
    level: 10,
    coins: 500,
    unlockedGoodIds: unlocked,
    hasSolvableOpenOrder: true,
  });
  expect(board.map((order) => order.difficulty)).toEqual(["easy", "medium", "specialized"]);
  expect(board[1]?.id).toBe("ORD-MED-CHEESE");
  expect(board[2]?.id).toBe("ORD-SPEC-BOOKS");

  const level4 = generateOrderBoard({
    level: 4,
    coins: 500,
    unlockedGoodIds: ["GOOD_WHEAT", "GOOD_BREAD", "GOOD_TIMBER", "GOOD_PLANKS"],
    hasSolvableOpenOrder: true,
  });
  expect(level4.map((order) => order.id)).toEqual(["ORD-EASY-BREAD", "ORD-MED-PLANKS", "ORD-SPEC-PLANKS"]);
});

test("starter map is 24x24 over the four open chunks", () => {
  expect(STARTER_MAP.width).toBe(24);
  expect(STARTER_MAP.height).toBe(24);
  expect(STARTER_MAP.chunkSize).toBe(12);
  expect(STARTER_MAP.chunks).toEqual([
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]);
  expect(STARTER_MAP.rows).toHaveLength(24);
  expect(STARTER_MAP.rows.every((row) => row.length === 24)).toBe(true);

  const hall = STARTER_MAP.townHall;
  expect(hall).toEqual({ x: 4, y: 4, width: 4, height: 4 });
  for (let y = hall.y; y < hall.y + hall.height; y += 1) {
    for (let x = hall.x; x < hall.x + hall.width; x += 1) {
      expect(STARTER_MAP.rows[y]?.[x]).toBe("plaza");
    }
  }
  expect(STARTER_MAP.rows[3]?.[3]).toBe("plaza");
  expect(STARTER_MAP.rows[8]?.[8]).toBe("plaza");

  const flat = STARTER_MAP.rows.flat();
  expect(flat).toContain("grass");
  expect(flat).toContain("grass_flowers");
  expect(flat).toContain("plaza");
  expect(flat).toContain("water");
  expect(flat).toContain("shore");
  expect(STARTER_MAP.rows.every((row) => row[23] === "water" && row[22] === "shore")).toBe(true);
});
