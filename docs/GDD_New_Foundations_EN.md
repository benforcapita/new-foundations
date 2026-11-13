# NEW FOUNDATIONS — Connected Cities
## Game Design Document (GDD) — Development Baseline v1.0

**Status:** Implementation-oriented design baseline; NOT validated by playtesting  
**Updated:** November 13, 2026  
**Genre:** Cozy social city builder / accessible economy / asynchronous co-op  
**Target platforms:** iOS and Android first; optional Web/PC companion sharing the same saved city  
**Game modes:** Complete single-player experience, with optional social layer  
**Business model:** Fair free-to-play centered on cosmetics and a season pass  
**Research working title:** *CityVille: New Foundations*; recommended independent brand: **New Foundations — Connected Cities**.

> **Source and design boundary:** This document develops the user's CityVille research report, *“CityVille — What Worked, What Failed, and a GDD for a Modern Version.”* The historical analysis and the KEEP / CHANGE / REMOVE decisions come from that report. All prices, timers, formulas, performance targets, schedules, and implementation decisions below are NEW PROTOTYPE ASSUMPTIONS requiring balance simulations and playtests; they are not historical CityVille data. Do not use the original CityVille name, logos, or art in a commercial product without permission.

---

# 01. Executive Summary and Product Vision

**Player fantasy:** Start with a small parcel, create a living town, build connected agriculture → production → commerce chains, and gradually shape a distinctive city. The emotional progression should be “I built a house” → “I built a neighborhood I am proud to show,” without turning a daily login into an obligation.

**20-second pitch:** Build a city at your own pace, grow and manufacture goods, fulfill orders, unlock districts, and operate mutually profitable franchises in neighboring cities. Every small decision changes the look and economy of the town. The game is entirely playable alone; friends add commerce, inspiration, and rewards, but never serve as mandatory progression gates.

**KEEP from the original:** Residential, commercial and civic construction; goods supply; coins and XP; land expansion; meaningful decorations; always-open quests; city visits; and especially **franchising**, where a branch of your business in another player's city rewards both parties.

**CHANGE:** Remove energy costs per interaction, withering crops, real-friend requirements, building-by-building collection, and purchases offered to resolve social pressure. Add Collect All, queued manufacturing, short flexible sessions, NPC neighbors, opt-in co-op, and controlled synchronization.

**Measurable experience promises:** Complete a full loop during the first 60 seconds; make meaningful progress in every 3–5-minute visit; open the first franchise with an NPC without finding a real friend; and have a distinctive, photo-worthy city within seven days of play.

## 01.1 Target audience

- **Primary:** Casual and cozy players roughly aged 28–50 who enjoy arranging, decorating, collecting and light tasks. No urban-planning expertise or min-maxing required.
- **Secondary:** Veteran city-builder fans looking for accessible economics and asynchronous sharing; creative players who like photography and showcasing their cities.
- **Not the main audience:** Hardcore SimCity-style simulation players, competitive guild warfare, real-time PvP or games that take away property when someone goes on vacation.

## 01.2 Unique selling propositions

1. **Reciprocal franchises are a core loop, not a “request help” button.** A real host plot, supply agreement and visible revenue distribution benefit both sides.
2. **Aesthetics matter without becoming mandatory optimization.** Parks and decorations provide modest, capped bonuses and enable personal expression.
3. **Life outside the game is respected.** Mature crops wait; inventories do not spoil; main quests cannot fail because a timer expired.
4. **Solo first.** NPC cities, virtual neighbors and resident workers make every system functional without online friends.
5. **One long-lived city.** Future districts and features expand the existing game rather than requiring migration to an unrelated sequel.

---

# 02. Six Design Pillars — The Product Contract

| Pillar | Product decision | Acceptance test |
|---|---|---|
| Always something to do; never an obligation | Three parallel quest tracks; no FOMO in core progression | At least one available main objective at all times |
| Friends are a bonus | No construction, population or district locks requiring friend invites | A player with zero friends can access every core capability |
| A city that feels yours | Free placement, cosmetic variety and photo mode | Two same-level cities can look meaningfully different |
| Respect for player time | Collect All, queues, district helpers and bulk actions | 200 buildings never require 200 individual taps |
| One city across platforms | One save, with Web/PC support planned later | No split economy or separate city per device |
| Trust is a feature | No pay-or-invite, paid loot boxes or counterfeit friends | Zero structural blockers; system helpers are labeled as NPCs |

**Deliberate adjustment to the source report:** The source proposal suggested silently filling ignored assistance requests via AI/NPC after 12 hours without saying whether help came from a human. This design instead labels it **“Help from Town Residents.”** It preserves the no-blockers promise without impersonating actual friends.

---

# 03. Gameplay Structure and Session Cadence

## 03.1 Core loop — 3–5 minutes

```text
Open the city → Collect All (Coins / finished goods)
              ↓
Review three active orders → fulfill an order or queue production
              ↓
Build / upgrade / decorate → earn XP and advance an objective
              ↓
Dispatch a train or ship, or supply a franchise branch
              ↓
Leave the city with at least one productive queue running
```

**Minimum meaningful session:** One action moves a goal forward, at least one production queue is active, and the player receives readable visual feedback. The UI must not imply a four-minute return is mandatory; timers are planning cues, not obligations.

## 03.2 Supporting loops

- **Immediate (5–30 seconds):** Collect a reward, fulfill an order, place a decoration, send a train.
- **Daily (3–15 minutes, possibly split):** Operate shops, improve a neighborhood, follow a story mission, resupply a branch.
- **Weekly:** Develop a district, join an optional co-op project, complete a city quest chain.
- **Seasonal (five-week design assumption):** Collect a fresh district look, meet themed NPCs, earn cosmetic buildings and contribute to community goals.
- **Long term:** Create a multidistrict city with trade relationships and a recognizable personal style, without resets.

## 03.3 Proposed production timing — seed values only

| Duration | Purpose | Examples |
|---|---|---|
| Immediate–3 minutes | Discovery and tutorial | Wheat, timber, clearing a parcel |
| 5–15 minutes | Short follow-up session | Flour, bread, small order |
| 30–90 minutes | Flexible daily return | Train delivery, shop upgrade |
| 4–8 hours | Decision before leaving | Cargo ship, civic construction |
| 8–24 hours | Long-term, no punctual login required | Landmark and district upgrades |

Crops do not wilt. If an order expires, the goods remain in storage and the board generates a replacement. Resources are never confiscated because a timer elapsed.

---

# 04. Onboarding — First 60 Seconds and First Seven Days

## 04.1 Fixed starter state

- **Map:** 24×24 unlocked tiles; future expansions are 12×12 blocks available for soft currency only.
- **Initial scene:** One prebuilt small Town Hall, one home, one grocery marked “Needs Supply,” two farm plots, three tutorial-only units of Bread ready in the warehouse, and 40 storage slots.
- **Starting balance:** 750 Coins; no premium gems required. Early quests grant enough soft currency for the next meaningful build.
- **Guide:** Mia the Engineer, one friendly NPC who uses contextual gestures and actions instead of walls of text.

## 04.2 Tutorial script: 0–60 seconds

| Time | Player action | Feedback | Telemetry |
|---|---|---|---|
| 00–08s | Camera focuses on an open plot and highlights a house | Green placement ghost | `tutorial_started` |
| 08–18s | Drag and drop the house | Construction pop, +8 residents, XP | `building_placed` |
| 18–30s | Tap a ready wheat plot | 3 Wheat animate into inventory | `goods_collected` |
| 30–43s | Select Grocery → Supply with 3 starter Bread | Inventory becomes 3; “Open” sign | `business_supplied` |
| 43–55s | Collect first earnings from a one-time accelerated tutorial cycle (normal cycle is 10 min) | Coins fly to HUD, XP, building lights | `coins_collected` |
| 55–60s | New objective: “Build a Bakery” | Progress card and small reward | `tutorial_core_complete` |

**Acceptance:** A new player with no written tutorial can place a house, supply a shop and collect payment within 60–90 seconds. User tests record errors and whether instructional UI obscures interactive buildings.

## 04.3 First 15 minutes

1. Place a second home and extend a road; reward 100 Coins.
2. Build Bakery / Workshop and use the first production queue; reward one free quick-fix token.
3. Fulfill the first order, dispatch an NPC train and return to the map.
4. Visit an NPC demonstration city; perform up to five help actions; experience a **one-time trial franchise** before the full Franchise Board unlock at Level 8.
5. Choose between a small public garden and another commercial establishment for a second open objective.

## 04.4 Day 1 → Day 7

- **Day 1:** Goods + orders, city photo, first NPC franchise.
- **Days 2–3:** Railway, two manufacturing types, first civic building, neighborhood quest.
- **Days 4–5:** Commercial street, personal decorations and small capped adjacency boosts.
- **Days 6–7:** Second district milestone (not calendar-gated), voluntary photo/share.
- **Week 2 target:** Themed districts and optional co-op, unlocked by achievement rather than elapsed calendar days.

---

# 05. World Map, Construction and Camera

## 05.1 World representation

- Orthographic isometric 2.5D display, with logical 2D `(x,y)` grid and consistent bottom-center sprite pivot.
- Starter map 24×24; synthetic stress scene 96×96 with at least 500 buildings.
- Building footprints: 1×1, 2×2, 3×3, 4×4 and 4×6 for landmark infrastructure; 90° rotation across four orientations.
- Terrain: grass, roads, plaza, water and shoreline. Complex elevation/terrain modification is **outside MVP**.
- Road access is NOT required for functionality in MVP. Connected roads provide a capped +5% transport bonus, avoiding punishment for aesthetic choices.

## 05.2 Placement rules

- `canPlace` validates map ownership, occupancy, footprint, terrain type and bounds.
- Placement ghost: green = valid; red = blocked; yellow line = recommended road connection, not mandatory.
- Move and Rotate are free, even after construction. Selling/removing a building requires confirmation and supports 10-second Undo.
- Build Mode simplifies the HUD, supports an undo stack of 20 moves; multi-select neighborhood editing is phase 2.
- Do not build a costly real-time traffic simulation for initial release. Animated trains/buses follow authored visual paths instead.

## 05.3 Input and camera

| Action | Mobile | Desktop/Web |
|---|---|---|
| Pan | Single-finger drag | Mouse / keyboard pan |
| Zoom | Pinch | Mouse wheel |
| Rotate building | Rotate button | `R` |
| Move building | Long-press and drag | Click and drag |
| Photo | HUD camera button | `P` |
| Collect All | Always-visible action | `C` |

Mobile camera zoom range is approximately 0.65–2.0. Close zoom shows detailed facades; distant zoom uses LOD sprites or status indicators. Labels must never hide buildings or block placement.

---

# 06. Building Families and Definitions

| Family | Player value | Examples | Rules |
|---|---|---|---|
| Residential | Population and periodic rent | Cottage, rowhouse, apartments | Residents count toward population cap |
| Commercial | Consume goods for coins | Grocery, café, bookstore | No income without stock; capped inventory |
| Production | Convert input goods | Bakery, carpenter, dairy | Queued production; no repeated taps per stage |
| Agriculture | Produce basic inputs | Wheat, trees, corn | Finished harvest waits indefinitely |
| Civic | Population cap and story | Town Hall, school, clinic | NPC staffing by default; friends optional |
| Logistics | Shipments and changing demand | Train Station, Harbor | Works without human friends |
| Decoration | Beauty and small local modifiers | Park, fountain, trees | Capped boost; premium does not outperform free equivalents |
| Landmark | Milestones and distinctive photos | Clock Tower, bridge, museum | Optional long-form projects with one-time rewards |

## 06.1 Building state machine

```text
LOCKED → AVAILABLE → UNDER_CONSTRUCTION → ACTIVE
ACTIVE → [READY_TO_COLLECT | NEEDS_SUPPLY | PRODUCING | UPGRADING]
UPGRADING → ACTIVE
ACTIVE → RELOCATING → ACTIVE
```

Each instance stores `id`, `building_definition_id`, `level`, `position`, `rotation`, `inventory`, `timers`, and `version`. A single tap starts construction; it is not a three-to-four-click action as in the original. An empty shop remains attractive but shows a small “Needs Supply” state, not an abandoned-city penalty.

## 06.2 Seed building catalog — 12 core buildings

| ID | Building | Footprint | Coins | Build time | Unlock | Function |
|---|---|---|---:|---|---|---|
| B-001 | Timber Cottage | 2×2 | 180 | First free-instant; later 30s | L1 | +8 residents; 32 Coins / 8m |
| B-002 | Rowhouse | 2×2 | 430 | 3m | L4 | +18 residents; 60 Coins / 15m |
| B-003 | Apartment Building | 3×3 | 1,750 | 40m | L9 | +50 residents; 140 Coins / 30m |
| B-004 | Grocery Store | 2×2 | 500 | First instant; later 2m | L1 | 3 Goods → 110 Coins / 10m |
| B-005 | Café | 2×2 | 980 | 12m | L5 | 4 Goods → 185 Coins / 20m |
| B-006 | Bookstore | 2×2 | 1,800 | 35m | L10 | 6 Goods → 290 Coins / 35m |
| B-007 | Bakery | 2×2 | 350 | First free-instant; later 3m | L1 | 2 Wheat → 3 Bread / 6m |
| B-008 | Carpenter Workshop | 3×3 | 860 | 10m | L4 | 3 Timber → 2 Planks / 15m |
| B-009 | Town Hall | 4×4 | Free | Prebuilt | L1 | +50 population cap; tutorial NPC |
| B-010 | School | 3×3 | 1,250 | 30m | L6 | +75 population cap |
| B-011 | Train Station | 4×3 | 900 | 8m | L3 | Shipment orders; NPC market |
| B-012 | Neighborhood Park | 3×3 | 600 | 5m | L4 | Beauty + 3% nearby business boost |

These are **balancing seeds**, not locked values. The tutorial includes free placement or scripted currency rewards for the early Grocery and Bakery: 750 starting Coins must not cause a tutorial softlock.

---

# 07. Goods, Warehouse and Orders

## 07.1 Goods data model

Each good includes `good_id`, `tier`, `source_definition_id`, `production_time_sec`, `inputs`, `outputs`, `storage_units=1`, `sell_value_seed`, `icon`, `unlock_level` and `tags`.

| Good | Tier | Inputs | Output | Time | Used by |
|---|---|---|---|---|---|
| Wheat | Raw | Wheat plot | 3 Wheat | 3m | Bakery, Railway |
| Timber | Raw | Tree plot | 3 Timber | 5m | Carpenter, expansion |
| Milk | Raw | Small farm | 3 Milk | 8m | Café, Cheese |
| Bread | Finished | 2 Wheat | 3 Bread | 6m | Grocery, orders |
| Planks | Finished | 3 Timber | 2 Planks | 15m | Civic buildings |
| Cheese | Finished | 2 Milk | 2 Cheese | 12m | Café, Railway |
| Books | Advanced | 2 Timber + 1 Paint | 2 Books | 30m | Bookstore |
| Paint | Advanced | 2 Flowers | 2 Paint | 20m | Books, upgrades |

Agriculture supplies cheap local inputs; factories are queued converters; rail/harbor move larger orders over longer intervals. Railway rewards offer Coins and progression but must not completely replace local goods production.

## 07.2 Production queues

- Factories begin with **two queue slots**. The third is unlockable through regular progression; optionally purchased convenience can never be necessary to obtain a new product.
- When production finishes, goods move to `OUTPUT_READY` and wait. If storage is full, finished goods remain at the producer until capacity opens; nothing is destroyed.
- `Collect All` gathers as many ready stacks as fit. Example: “3 of 5 collected — Warehouse Full.”
- Restock is a single action: transfer eligible goods, start the sale cycle and show projected Coin yield.

## 07.3 Warehouse

Start at 40 units; upgrade in +20 increments using Coins and earned building materials. No premium-only capacity wall. Collect priority can be “Quest First” (default) or “Oldest First.”

## 07.4 Order Board

- Always offer three orders: easy (1–2 goods types), medium (2–4), and specialized (a newly introduced product or district ingredient).
- Completing an order yields Coins + XP + a `Civic Star` progression mark, and immediately generates a new card after reward feedback.
- One free reroll every 15 minutes; no penalty. Story orders do not expire.
- Generator checks `solvable=true`, currently unlocked recipes/capacity, and avoids making all three cards demand the same rare good.
- Seed rewards: `3 Bread → 180 Coins + 12 XP`; `2 Planks + 1 Bread → 325 Coins + 25 XP`.

## 07.5 Train and ship

- **Railway (L3):** Three wagons with distinct needs. Filling one grants an immediate partial reward; filling all grants a nonessential completion bonus. NPC train returns after approximately 45–90 minutes.
- **Harbor (later milestone):** Larger high-value shipments over 4–8 hours. Not required for daily goals.
- Missing a train is not punitive: it departs with what has been supplied and the next one returns. Any streak is a positive bonus only.

---

# 08. Economy and Balancing

## 08.1 Resource types

| Resource | Earned from | Spent on | Trust rule |
|---|---|---|---|
| Coins | Rent, shops, orders, trains | Construction, land, upgrades | Always earnable through normal play |
| Gems | Purchases, Pass and limited achievements | Cosmetics, optional speedups | Never bypasses a mandatory friend gate |
| XP | Core actions | Levels and unlocks | Not directly for sale |
| Civic Stars | Projects and milestones | Narrative/district unlocks | Not sold or traded |
| Goods | Production and shipments | Shops, construction, orders | Never spoil |

## 08.2 Preliminary formulas

```text
population       = sum(residential.population_by_level)
population_cap   = sum(civic.population_cap_by_level)
collectible      = floor((server_now - last_collected_at) / cycle_time) * base_reward
                   [capped to 12 hours of passive cycles]
decoration_boost = min(0.20, sum(unique_nearby_earned_or_paid_decor_bonus))
road_bonus       = 0.05 if connected_to_road else 0
business_reward  = base_coins * (1 + decoration_boost + road_bonus)
order_reward     = base_order_reward * difficulty_coefficient * district_coefficient
franchise_split  = total_value * {host: 0.40, owner: 0.60}  [seed]
```

Business earnings require a prior successful Restock. Interrupted cycles never duplicate rewards. Replaying a confirmed command with the same `command_id` must be an idempotent no-op.

## 08.3 Sources, sinks and inflation controls

- **Faucets:** Rent, shop sales, orders, trains, quests.
- **Sinks:** New construction, expansion, homes/shops/warehouse upgrades, soft-currency décor, civic projects.
- Day 1 should support placing three to five meaningful objects without waiting due to a Coins shortage. By Day 7 the player should have an interesting choice between at least two upgrades.
- Never sell unlimited direct conversion of premium Gems into soft Coins that makes all economic tradeoffs irrelevant.
- Keep solo players viable via fair NPC market prices. Any anti-exploit inflow limit must address abuse rather than constrain ordinary play.

## 08.4 Ten-minute seed scenario

A Grocery stocked with 3 Bread pays 110 Coins per 10 minutes; one house pays 32 Coins per eight minutes; an order requiring 3 Bread pays 180 Coins. Completing one order and collecting one residential rent cycle in ten minutes would grant about **212 Coins**, without double counting. This is a test case, not a prediction of average earnings. Tune with at least 1,000 simulated sessions across varied play patterns.

## 08.5 Softlock prevention

- If Coins are low, at least one easy order requiring a currently available Good remains solvable with a zero- or near-zero-cost starting recipe.
- A full warehouse offers transparent ways to supply a shop/order or free storage space.
- Reaching population cap cannot destroy existing houses; a new civic cap building must be obtainable with gameplay currency.
- Any noncommercial player-help request unanswered after 12 hours can be completed for free by a **clearly labeled NPC resident**.

---

# 09. Levels, Quests and Districts

## 09.1 Progress tracks

- **Story:** Small resident storylines with 3–4 steps; character encounters, bridges, and cafés. No expiry.
- **Growth:** Population, business count, land expansion and transport terminal milestones.
- **Weekly:** Bonus tasks for Coins/XP/cosmetics. Missing a week never closes a map district or blocks the story.

## 09.2 Unlock plan: Levels 1–15

| Milestone | Unlock | Player goal | System |
|---|---|---|---|
| L1 | Housing, Wheat, Bakery, Grocery | 60-second core loop | Economy |
| L2 | Town Hall staff NPC | Population cap | Civic |
| L3 | Train Station | First shipment | Logistics |
| L4 | Park, Carpenter, Rowhouse | Advanced goods | Construction |
| L5 | Café, medium orders | Manufacturing queue | Orders |
| L6 | School | Increase population cap | Civic |
| L7 | Weekly optional quests | Player choice | Live Ops |
| L8 | Full NPC Franchise Board (after Day 1 trial) | Reciprocal profit | Social |
| L9 | Apartments | Higher density | Economy |
| L10 | Human-player franchises, optional co-op | Real-world social trade | Social |
| L12 | Harbor and bulk shipments | Longer loop | Logistics |
| Week 2 milestone | Second themed district | Horizontal progression | Districts |
| L15 | First Landmark | Signature city silhouette | Expression |

“Week 2” is a pacing target, not a requirement to log in on seven distinct days.

## 09.3 Themed districts

A district is a playable cluster: a style set, one or two signature business types, a local NPC, a questline, and a landscape variant. Players identify the cluster themselves; it is not rigid zoning.

| District | Fantasy | Distinctive mechanic | Art direction |
|---|---|---|---|
| Town Center | Warm, walkable commerce | Grocery, café, decoration | Brick, sage green |
| Harbor | Movement and trade | Ships, bulk goods, waterfront | Sea blue, weathered wood, bridges |
| Campus | Knowledge and making | Books and public upgrades | Light stone, autumn trees |
| Garden Quarter | Community and nature | Parks, flowers, photo spots | Blossoms, greenhouses, paths |

**Scope guardrail:** MVP includes Town Center only. Harbor, Campus and Garden Quarter are separate production packages, not implied deliverables because they appear in the design vision.

---

# 10. Franchises — The Signature Social Mechanic

## 10.1 Core idea

Player A owns a small local business brand. Player B, either a human or an NPC host, owns an available franchise plot in another city. A submits a proposal; B accepts (or an NPC approves immediately); A supplies the new branch; and both receive clearly displayed shares of its revenue. No hidden fees or artificial friendship gates.

## 10.2 Player journey

1. A opens a local business → `Open Franchise` → chooses a host / NPC.
2. The offer card displays plot footprint, required goods, expected cycle profit, transparent split and host status.
3. A sends a request. B accepts asynchronously; an NPC can host a trial instantly.
4. A branch appears on the host plot. The owner's city gains a growing Franchise Headquarters tower: an extra floor per branch, **cosmetic only**.
5. A dispatches Goods. The branch earns revenue, automatically crediting both host and owner.
6. An optional daily supply streak provides a shared **0–10% positive bonus**. Missing a day resets only the bonus, never fines the players or removes the branch.

## 10.3 Product and server rules

- One active branch per brand in MVP; later increase to five through achievement. Solo players can unlock the same capacity.
- Typical cycle: 45 minutes, with up to two cycles of stock queued ahead.
- Seed split: **60% brand owner, 40% host**, before streak bonuses; test alternatives.
- Pending proposals expire after 48 hours without penalties and can be resent. NPC hosts are always available.
- Ownership transfers, removals and settlements must be versioned on the server to prevent inventory duplication.
- Human plot hosting and termination use explicit consent; no NPC masquerades as a human player.

## 10.4 Franchise state machine

```text
DRAFT → REQUESTED → ACCEPTED → ACTIVE → [SUPPLIED → EARNING → READY] ↺
                   ↘ DECLINED / EXPIRED
ACTIVE → PAUSED → ACTIVE
ACTIVE → TERMINATED (with final settlement)
```

## 10.5 Franchise quests

- **Tutorial:** “Open a Grocery branch in Dana's City (NPC)” → pick supply → earn 100 Coins/XP and see how shared profits work.
- **Social:** Supply a partner twice → unlock a cosmetic shop sign, **not** a progression gate.
- **Event:** Shared Shopping Street → optional group of five players supply the same co-op city.

## 10.6 Critical telemetry

`franchise_offer_viewed`, `franchise_requested`, `franchise_accepted`, `franchise_first_supply`, `franchise_first_profit`, `franchise_week_2_retained`. Franchise north-star: percentage of eligible players achieving their **first shared profit within 24 hours of unlock**.

---

# 11. Solo Mode, NPCs, Visits and Co-op

- **NPC cities:** At least two authored settlements with distinct aesthetics that accept visits and franchises. No runtime generative AI is needed for MVP; deterministic NPC scripting is more reliable and inexpensive.
- **Visits:** Up to five assistance actions per visit per 12-hour window, for NPC or human cities: harvest, clean up, decorate or supply. Minor XP/Coins and Reputation rewards. The host may accept or hide visit events.
- **Assistance:** Never essential to progression. An unanswered request is fulfilled by an NPC in 12 hours for free and credited transparently.
- **Co-op:** Up to 30 members during Soft Launch, supporting joint shipments, optional chat and weekly collective goals. No leaderboard rewards that punish smaller groups.
- **Safety:** Block/report, chat filters, invite rate limits, privacy controls and no player-to-player transfer of premium Gems.
- **Private by default:** Editable display names and city profile; no real location, contact list or Facebook account required.

---
# 12. Quests, Live Operations and Seasonal Content

## 12.1 Quest definition template

```yaml
id: quest_early_bakery_01
track: story
prerequisites: [tutorial_core_complete]
steps:
  - event: building_placed
    filter: {building_definition_id: B-007}
    amount: 1
  - event: goods_produced
    filter: {good_id: GOOD_BREAD}
    amount: 3
reward: {coins: 150, xp: 25}
can_expire: false
can_purchase_skip: false
localization_key: quest.early_bakery.title
```

## 12.2 Proposed production cadence (not a historical CityVille claim)

| Cycle | Content | Asset requirements |
|---|---|---|
| Weekly | 3–5 optional missions and a co-op challenge | 2 icons, 1 banner |
| Every 5 weeks | Free + premium Season Pass and new style | 6 decorations, 2 skins, 4 UI elements |
| Quarterly | One district or logistics-system expansion | 8–15 buildings, terrain set, local NPC |

Separate quests and reward tables from compiled client code; ship via versioned Remote Config. Every live event has a kill switch. When temporary goods become obsolete, convert them fairly instead of confiscating them.

---

# 13. Monetization Principles and Implementation

## 13.1 Allowed

- **Five-week Season Pass** with a fully playable free track and a cosmetic-centered premium track. Illustrative starting price **USD 4.99–7.99**, subject to market research and store rules.
- Visual skins for houses, shops and district themes; unique décor, photo-mode effects, borders and fictional franchise branding.
- Limited convenience: selected build accelerations and extra production queue slots, all obtainable through normal progression.
- Founder packs with cosmetic recognition, never a permanent exclusive economy advantage.

## 13.2 Prohibited

- Energy refills required for ordinary taps; “pay instead of invite a friend”; premium-only zoning permits; paid loot boxes; offer walls; purchasable bypasses of mandatory residents/chapters; aggressive FOMO; inactivity penalties.
- Premium decorations with higher mechanical multipliers than comparable earned items.
- Unlimited hard-to-soft currency conversions that trivialize the economy and all its sinks.

## 13.3 Purchase operations

- Two-stage purchase confirmation, Restore Purchases, store-compliant refund handling, entitlement audit trail and clear currency pricing.
- Introduce the store only after the player completes the central tutorial, never in the first 60 seconds.
- Provide monthly-spending visibility and options to reduce repeated offers. Never label a deal “last chance” without a real expiration.

---

# 14. UX, Screens and Feedback

## 14.1 Required screens

| Screen | Purpose | Main actions | Edge case |
|---|---|---|---|
| City View | Primary map and HUD | Build, Collect All, Orders, Zoom | Disconnected, warehouse full |
| Build Catalog | Browse placeable content | Search, Preview, Place | Insufficient Coins, locked item |
| Building Details | Building information | Upgrade, Stock, Move, Franchise | Upgrade underway, no Goods |
| Production Queue | Scheduling recipes | Add/Cancel, Collect | Storage overflow |
| Order Board | Three standing requests | Fulfill, Inspect, Reroll | Recipe not unlocked |
| Railway / Harbor | Bulk shipments | Assign Goods, Dispatch | Partial wagon |
| Franchise Board | Agreements | Browse, Request, Supply, Settle | Expired invitation, NPC host |
| District Planner | District look and objectives | Select goal, preview milestone | District locked |
| Social / Co-op | Neighbors and groups | Visit, Invite, Donate, Report | Zero friends, no co-op |
| Season / Shop | Cosmetics and entitlements | Preview, Buy, Restore | Season ended |
| Photo Mode | Capture/share | Hide HUD, reposition camera, export | High-res image |
| Settings | Accessibility / privacy | Audio, motion, account export/delete | Offline |

## 14.2 Primary HUD wireframe

```text
[Avatar | Level + XP]         [Coins] [Gems] [Warehouse 23/40]

[Story: A Cozy Corner...]                          [Season: 12d]

                       ISOMETRIC CITY VIEW

[Collect All]               [Only meaningful Ready badges]

[Build] [Orders] [Train] [Franchise] [Community] [Menu]
```

- Collect All is always visible, but quietly disabled when nothing is ready.
- The `!` badge appears only for a decision that meaningfully needs attention, not every completed timer.
- Reward sounds are positive and brief; independent Music and SFX mute and Reduced Motion are supported.
- A Smart Tip can appear no more than once per session after the tutorial, and can be disabled.

## 14.3 Micro-interactions

- **Placement:** Soft green ghost, 160–220 ms spring on approval, a clear +Residents bubble.
- **Collection:** Coins arc into the HUD over approximately 400 ms without blocking input.
- **Restock:** Miniature crates travel toward a shop door; the “Open” sign returns.
- **Rail:** Wagons show completion without frightening departure countdowns.
- **Level up:** Full-screen reward display no longer than two seconds; always skippable.

## 14.4 Accessibility and localization

- **English-first interface.** Maintain localization keys for future Hebrew RTL, French and Spanish; do not mirror the isometric world automatically when localizing layout direction.
- Minimum hit targets 44×44 pt; text scaling without clipping; WCAG AA contrast for interface text.
- Status must not depend on color alone; pair red/green with symbols and text.
- Colorblind-friendly palette, Reduced Motion, subtitles, separate music/SFX sliders.
- Provide a per-district building list so players need not tap tiny buildings at low zoom.
- Build all text into localized UI layers, not into graphics or building sprites.

---

# 15. Art Direction and Art Bible

## 15.1 Visual language

**Style:** “Cozy premium isometric.” A 2.5D orthographic city using simple geometry, soft edges, painterly materials and high legibility on six-inch phones. Not photorealistic and not a reconstruction of Zynga's original assets.

**Shapes and silhouette:** Keep walls relatively low compared to roofs so roads remain visible. Enlarge windows around 10–20% beyond strict realism. Use three to five well-defined color zones and a single soft ground shadow per sprite.

| Color role | Hex | Usage |
|---|---|---|
| Grass | `#9BCB91` | Terrain and lawns |
| Park Deep | `#5A9B79` | Trees and nature shading |
| Warm Sun | `#F6C86E` | Coins, lit windows, success |
| Brick | `#D98669` | Stores and residences |
| Roof Coral | `#BC5B59` | Roofing and highlights |
| Harbor Teal | `#3B8392` | Water and logistics |
| Sky Cream | `#F8EEDB` | Background and UI |
| Ink Navy | `#253D4A` | Text and contrast |
| UI Good | `#2C9D8F` | Enabled actions |
| UI Warning | `#D99A4C` | Stock and noncritical states |

Use warm, late-afternoon sunlight with subtle cosmetic day/evening variation; changes to lighting never affect economy timers or Coin yield.

## 15.2 Production art specifications

- **World tiles:** Nominal isometric tile 128×64 px, 256×128 authoring art at 2×; transparent PNG/WebP. Standardized per-type pivot, typically X=0.5 and Y=0.75–1.0.
- **Buildings:** 1024×1024 transparent master, exported to 512×512 PNG/WebP for prototype; optional four orientations. Ground anchor bottom-center; silhouette under 90% of available width.
- **Sprite metadata:** `frameRect`, `pivot`, `footprint`, `pixelsPerUnit`, `animations`; atlas per district.
- **UI icons:** 128×128 vector master, 64 px and 128 px exports, consistent 6–8 px stroke with high readability.
- **Motion:** Building idle details around 4–8 fps; collect effects 300–600 ms; animated trains around 10–15 fps.
- **Texture budget:** Up to 2048×2048 atlases on low-end devices, sprite packing and batching; measure actual memory and draw calls on device.
- **Signage:** No baked-in translated text; apply localized signage using separate text layers or symbol-only visual design.

## 15.3 Residents and narrative tone

- **Mia, Civic Engineer:** Practical, concise, upbeat tutorial guide.
- **Dana, Neighboring Merchant:** Friendly NPC host explaining the first franchise.
- **Tom, Station Manager:** Introduces trade and railway shipments.
- **Amir, Gardener:** Teaches decoration, parks and neighborhood identity.

Avoid shame-based copy such as “You disappointed your citizens.” Prefer actionable wording: “The bakery made three loaves. Want to stock the Grocery?”

## 15.4 Audio direction

- Two original instrumental loops: **City Day** and **City Evening**, approximately 70–95 BPM, light acoustic palette; music always optional.
- About 12–16 short SFX: build, upgrade, small/large collect, coin, XP, train departure/arrival, button click, gentle error, success, subdued crowd cheer, panels.
- Quiet local ambience by district (birds, wind, waterfront). Mix comfortably in mono, and support stereo without relying on it for gameplay cues.

---

# 16. Asset Production Guide

The included `asset_manifest.csv` and `asset_manifest.json` contain stable IDs, families, English descriptions, production state, priority, phase, dimensions, dependencies and English creative briefs. The `assets/` folder contains actual original **prototype placeholder SVGs/PNGs**, not final shipping-grade illustration. All items marked `BRIEF_READY` require creation.

## 16.1 Asset folder structure

```text
assets/
  buildings/      # SVG sources and PNG sprites
  terrain/        # Isometric ground and road tiles
  decorations/    # Parks, trees, street furniture
  resources/      # Goods, Coins, Gems, XP
  ui/             # Controls, badges and state icons
  previews/       # Building sheet, icon sheet, example city
```

## 16.2 Production scale from MVP to a live product

| Asset family | Minimum MVP target | Quarter-2 target | Definition of done |
|---|---:|---:|---|
| Static buildings | 12 | 40+ | Asset ID, footprint, pivot, states |
| Terrain / roads | 10 | 25+ | Four-way seamless adjacency |
| Decorations | 8 | 35+ | Radius and behavior data |
| Goods icons | 8 | 24+ | Legible at 48 px |
| UI icons / badges | 18 | 50+ | Accessible, pressed/hover states |
| NPC portraits | 4 | 12+ | Three expressions each |
| VFX / animations | 8 | 24+ | Common actions resolve within 600 ms |
| Sound effects | 12 | 30+ | Loudness normalized |
| Music loops | 2 | 8+ | Seamless loop points |
| Promotional / store art | 4 | 20+ | Original, licensed and localized |

## 16.3 Naming convention

`{category}_{family}_{name}_{variant}_{orientation}_{state}_v{major}`

Examples: `bld_res_cottage_basic_sw_idle_v1.webp`, `tile_road_corner_ne_v1.png`, `ico_goods_bread_v1.svg`, `sfx_ui_collect_small_v1.ogg`. Internal gameplay IDs such as `B-001` do not change across locales or levels.

## 16.4 Building kit composition

Each building needs a source vector sketch, transparent prototype PNG, future production sprite, catalog thumbnail, footprint, and reusable state overlays for `under_construction`, `ready` and `unstocked`. Avoid redrawing an entire building just to show “Ready.” All new buildings require original silhouettes rather than scaling existing prototypes. Perform 64px recognition tests distinguishing a home from a store.

## 16.5 Asset Manifest as source of truth

**Status values:** `PLACEHOLDER`, `BRIEF_READY`, `IN_PRODUCTION`, `APPROVED`, `INTEGRATED`.  
**Priority:** `P0` vertical slice; `P1` full MVP; `P2` soft launch; `P3` future content. Placeholder art must never be mislabeled production-ready.

**Current English package:** 59 asset *entries* have usable SVG/PNG graphics; 45 additional entries are creative briefs only. Preview contact sheets are extra composite files, not additional individual asset entries.

---

# 17. Technical Architecture (Engine-Agnostic)

## 17.1 Suggested implementation approach

**Client:** Unity URP 2D/2.5D or Godot 4 for mobile-first deployment. Evaluate renderer batching, atlas workflow, device profile, licenses and the team's existing expertise. For an early web-first prototype, Phaser plus a React shell is a plausible alternative; do not silently treat it as equivalent to a production mobile engine without profiling.

**Server:** TypeScript/Node.js or .NET API; PostgreSQL for city state, economy and contracts; Redis for caching/queues; object storage for asset bundles and photo output; CDN; analytics and remote configuration. Any change to Coins, Goods, premium purchases or cross-city franchise state is **server-authoritative**.

## 17.2 Components and boundaries

```text
Client City State (optimistic presentation)
  ↕ HTTPS/REST + delta synchronization
API Gateway / Authentication
  ├── City module: placement, buildings, upgrades, versioning
  ├── Economy module: Coins, Goods ledger, timers, orders
  ├── Franchise module: contracts, ownership, revenue split
  ├── Social module: visits, co-ops, safety
  ├── Content module: quests, recipes, levels, seasons
  └── Purchases module: receipt verification, entitlements, restore
       ↓
PostgreSQL + Transactional Outbox + Queue + Redis Cache
```

For MVP, prefer a **modular monolith** over prematurely deployed microservices. These are code and data ownership boundaries, not necessarily six separately hosted applications. Timers resolve lazily using server timestamps rather than a scheduled background job for every farm plot.

## 17.3 Proposed database schema

| Table | Key fields | Integrity rule |
|---|---|---|
| `users` | `user_id, locale, created_at, settings` | Supports anonymous / durable identity |
| `cities` | `city_id, owner_id, name, level, xp, coins, version` | Versioned authoritative city snapshot |
| `city_cells` | `city_id, x, y, terrain_id, owner_claimed` | Unique `(city_id,x,y)` |
| `building_instances` | `id, city_id, definition_id, x, y, rotation, state, level, version` | Transactional placement |
| `inventory_ledger` | `transaction_id, city_id, good_id, delta, source, created_at` | Append-only anti-duplication ledger |
| `production_jobs` | `id, building_id, recipe_id, started_at, completes_at, claimed_at` | Server time only |
| `order_instances` | `order_id, city_id, requirements_json, status, version` | Exactly-once fulfillment |
| `franchises` | `id, owner_city, host_city, business_id, state, split_bps, version` | Cross-city consistency |
| `franchise_shipments` | `id, franchise_id, goods_json, reward_json, state` | Idempotent fulfillment |
| `quests` | `city_id, quest_id, step_state_json, status` | Domain event-driven |
| `player_entitlements` | `user_id, product_id, store_transaction_id` | Receipt verification |
| `command_dedup` | `actor_id, command_id, request_hash, result_json` | Idempotency |

## 17.4 Sample building definition

```json
{
  "id": "B-004",
  "type": "commercial",
  "nameKey": "building.grocery.name",
  "footprint": {"width": 2, "height": 2},
  "coinCost": 500,
  "buildSeconds": 120,
  "unlockLevel": 1,
  "inventoryCapacity": 9,
  "salesCycleSeconds": 600,
  "salesInput": {"GOOD_BREAD": 3},
  "salesOutput": {"COINS": 110},
  "art": "bld_com_grocery_basic_sw_idle_v1"
}
```

## 17.5 Initial API surface

```text
GET  /v1/cities/{cityId}/snapshot?sinceVersion=123
POST /v1/cities/{cityId}/commands/place-building
POST /v1/cities/{cityId}/commands/move-building
POST /v1/cities/{cityId}/commands/collect-all
POST /v1/cities/{cityId}/commands/start-production
POST /v1/cities/{cityId}/commands/fulfill-order
POST /v1/franchises/request
POST /v1/franchises/{id}/accept
POST /v1/franchises/{id}/supply
GET  /v1/content/catalog?version=42
GET  /v1/player/entitlements
```

Every POST includes an `Idempotency-Key`, expected `city_version`, and `content_version`. Client-side timestamps are for display only. The server determines authoritative time. Offline command queues preserve *intent*, never a client-controlled currency ledger.

## 17.6 Sync and partial offline

- Players may preview construction offline; server acceptance remains **Pending Sync**.
- Goods and Coins may animate optimistically, but balances are spendable only after server acknowledgement; never spend the same credit twice.
- Conflicting placement returns `409 Conflict` with a city delta and a chance to re-place, not silent deletion.
- Franchise supply debits the owner's goods and settles rewards via transactions, ledger entries and outbox events.
- Suggested offline placement queue window: up to 24 hours; human trade and purchases need connectivity. Passive rewards are capped at 12 hours.

## 17.7 Security and compliance

Never trust the client for Coins, Goods, XP, premium items or quest completion. Rate-limit actions, prevent replay through idempotency, audit purchases, enable legally required account export/deletion, maintain report/block moderation, minimize personal data, and validate actual app-store receipts rather than relying on a webhook alone.

---

# 18. Performance, QA and Nonfunctional Requirements

## 18.1 Proposed MVP budgets

| Metric | Proposed target | Test |
|---|---|---|
| Midrange mobile FPS | 60 most of the time | 100-building city |
| Lower-end mobile FPS | Stable 30 | 500+ buildings with LOD |
| Cold start | p90 ≤8 seconds | After first asset download |
| Placement feedback | ≤100 ms | Client-local visual response |
| Resident memory | ≤450 MB | Midrange device without pan spikes |
| Save / command sync | p95 ≤2 seconds | Typical network, one command + delta |
| Crash-free sessions | ≥99.5% | Soft-launch gating |
| Server economy availability | Design target 99.9% | Cost-dependent service SLO |

## 18.2 Essential test matrix

- 96×96 tiles, 500+ buildings, 30 ready badges, 100 animated NPC/vehicles; automated profiling.
- Placement with rotation, map boundary and road intersections; Undo after Move; save/restore across devices.
- Disconnect between Supply and Collect; concurrent logins; ten retries of the same POST; replayed command; locally altered clock.
- Storage becomes full as production completes; partially filled train departs; collected cycle cannot pay twice.
- Franchise hosting city is deleted/banned; season expires; duplicate/refunded purchases; entitlement restored.
- English UI plus Hebrew RTL regression testing, large fonts, Reduced Motion and offline connectivity.

---

# 19. Analytics, Release Gates and Kill / Pivot Criteria

## 19.1 Event taxonomy

**Core:** `session_started`, `session_ended`, `building_placed`, `building_moved`, `production_started`, `production_completed`, `goods_collected`, `business_supplied`, `coins_collected`, `order_completed`, `level_up`, `expansion_claimed`.

**Social:** `npc_city_visited`, `neighbor_city_visited`, `franchise_request`, `franchise_accepted`, `franchise_supply`, `franchise_reward_claimed`, `coop_joined`, `coop_help_accepted`, `report_submitted`.

**Economy:** `currency_earned`, `currency_spent`, `warehouse_overflow`, `build_blocked`, `progress_softlock_detected`, `offer_viewed`, `purchase_completed`, `refund_received`.

**Experiments:** `experiment_exposed`, `tutorial_skip`, `tutorial_step_failure`, `session_3min_progress_made`.

Events include pseudonymous `player_id`, `session_id`, `content_version`, `city_level`, `platform`, `experiment_id`, and trusted `timestamp_server`. Avoid storing unnecessary personal city names in telemetry payloads.

## 19.2 Soft-launch targets — hypotheses, NOT guaranteed industry benchmarks

| Metric | Seed gate | Response if missed |
|---|---:|---|
| Core tutorial completion | ≥90% | Fix UX before scaling acquisition |
| Time to core loop | p75 ≤90s | Investigate friction |
| D1 retention | ≥40% | Redesign opening/pacing |
| D7 retention | ≥15% | Improve midweek loops |
| D30 retention | ≥7% | Improve progression depth/districts |
| DAU/MAU at Day 30 | ≥25% | Review stickiness before major UA spend |
| First NPC franchise supply | ≥70% within 24h of eligibility | Reduce tutorial friction |
| Paid-only progression blockers | 0 | Launch blocker |
| Structural social blockers | 0 | Launch blocker |
| Crash-free sessions | ≥99.5% | Launch blocker |

**Proposed Go/No-Go:** Do not commit to large-scale paid acquisition if two consecutive test cohorts show D7 below 12% without credible improvement. Do not release with inventory duplication exploits, mandatory paywalls, or lost saves. These are proposed business gates, not claims from CityVille history.

## 19.3 Ethical A/B experiments

Test three vs five minutes for first session, three vs four orders, Railway vs Park feature order, or 60/40 vs 50/50 franchise split. Do **not** test friend-gated progression, intentionally slowed loops to sell speed, spam prompts or crop withering.

---

# 20. Scope, Milestones and Team

## 20.1 Phase 0 — Vertical Slice (8–10 weeks)

**In scope:** 24×24 map; four buildings; Wheat and Bread; Bakery/Grocery cycle; Coins and XP; three orders; one 12×12 land expansion; one NPC city; working franchise revenue split; server save; Collect All; 60-second tutorial.

**Out of scope:** Payments, store, pass, full co-op, Harbor, full 500-building live world, chat, generative NPCs, localization beyond necessary English/Hebrew support.

**Definition of done:** A player who has never read this document can complete the tutorial, fulfill an order and start an NPC franchise; closing/reopening retains all progress; no friends or payment needed.

## 20.2 Phase 1 — Playable MVP

**In:** Twelve seed buildings; eight Goods; trains; four resident NPCs; fifteen levels; three quest tracks; Photo Mode; décor; warehouse upgrades; partial offline; analytics; economy QA; synthetic 500-building stress scene.

**Out:** Thirty-member co-op, branded real-world campaigns, multiple live districts, Web companion and substantial IAP catalog.

## 20.3 Phase 2 — Soft Launch

**In:** Co-op, player-to-player franchises, first Season Pass, Store/Entitlements, live operations, two test markets, at least two interface languages, Remote Config, moderation and support tooling.

## 20.4 Phase 3 — Global and Ongoing

Harbor and Campus districts, quarterly feature content, Web/PC companion, larger cosmetic catalog, opt-in notifications and a funded ethical sunset plan.

## 20.5 Indicative team assumptions

- **Vertical Slice:** One game developer, one full-stack developer, half-time technical artist, half-time product/game designer, as-needed QA.
- **MVP/Soft Launch:** Two client developers, two backend developers, one game/economy designer, one to two 2D artists/animators, one QA, half-time analytics, half-time Live Ops/Product.
- The exact cost and staffing need an independent estimate. **Investment order:** Core loop → frame rate → save/economy correctness → franchise fun. Do not scale art/live events before retention is demonstrated.

---

# 21. Risks, Intellectual Property and Ethical Sunset

| Risk | Early warning | Mitigation |
|---|---|---|
| Generic builder lacks differentiation | Few players try franchises | Introduce clear NPC franchise value on Day 1 |
| Repetitive queue fatigue | Sessions become collection-only | Optional objectives, decorating, districts |
| Currency inflation | Level-8 players become excessively wealthy | Explicit sinks and cohort simulations |
| Scope creep | Harbor/co-op precedes stable core | Enforce gates for Phases 0–2 |
| Goods duplication exploit | Ledger and inventory diverge | Server authority and idempotency |
| Platform/channel dependence | Paid acquired players do not return | Community, diverse acquisition and retention first |
| IP infringement | Naming or visual assets too close to original | Independent branding, original art, legal review |
| Shutdown destroys trust | Players lose cities and purchases | Fund an ethical sunset procedure |

## 21.1 Proposed sunset commitment

When operationally possible, provide at least six months' notice before shutdown; stop new purchases during that notice period; enable city image export and a structured inventory/ownership report; maintain support; publish store- and law-compliant handling of recent purchases; and consider a view-only city archive if technically feasible. This is a product/design commitment to be funded, **not** a promise of nonexistent full offline play.

---

# 22. Acceptance Criteria and Product Backlog

| ID | User story | Given / When / Then | Priority |
|---|---|---|---|
| US-001 | Place a house | Given free plot, when placed, then footprint locks and population increases once | P0 |
| US-002 | Collect in one tap | Given five ready buildings, when Collect All, then rewards settle exactly once | P0 |
| US-003 | Supply a business | Given eligible Goods, when Supply, then inventory decreases and cycle starts | P0 |
| US-004 | Take a break without loss | Given harvest finished two days ago, when reopening, Goods still wait | P0 |
| US-005 | Complete an order | Given 3 Bread, when Fulfill, Goods debit and Coins/XP credit once | P0 |
| US-006 | Claim a new district parcel | Given Coins and milestone, when Expand, 12×12 owned cells are added | P0 |
| US-007 | Start a solo franchise | Given NPC host, when Apply, a branch opens without a human friend | P0 |
| US-008 | Benefit both parties | Given supplied branch, when settled, host/owner ledgers receive exact split | P0 |
| US-009 | Retry safely | Given repeated identical command ID, then reward is credited only once | P0 |
| US-010 | Switch devices | Given saved city, when signing in elsewhere, same snapshot loads | P1 |
| US-011 | Decorate freely | Given décor, when placed, total nearby boost stays ≤20% | P1 |
| US-012 | NPC help fallback | Given request ignored for 12h, NPC resident helps free and visibly | P2 |
| US-013 | Leave a co-op | Given group membership, when leaving, personal progress remains unblocked | P2 |
| US-014 | Buy cosmetics | Given verified receipt, when reopening, entitlement persists | P2 |
| US-015 | Capture the city | Given Photo Mode, when Export, PNG has no HUD and belongs to the player | P1 |

---

# 23. Open Prototype Decisions

| Decision | Current seed | How to validate |
|---|---|---|
| Unity vs Godot vs Web-first | Mobile-oriented game client, possible Web companion | 500-building stress test, developer cost, devices |
| Franchise revenue | 60/40 | Compare to 50/50: acceptance, supply frequency, retention |
| Timer mix | 3m/6m/10m, long cycles to 8h | Session satisfaction at 3–5 minutes |
| Bread recipe | 2 Wheat → 3 Bread | Supply chain and inflation simulation |
| Decoration modifier | +20% total cap | Understanding without coercive optimization |
| Warehouse | 40 units, +20 upgrades | Overflow rate, order abandonment |
| Retention targets | D1/D7/D30 = 40%/15%/7% | Soft-launch cohorts |
| First franchise | Full Board L8; NPC trial Day 1 | Early fun vs tutorial overload |
| Season Pass cadence | 5 weeks | Engagement and achievable content workload |

**MVP thesis:** First demonstrate that **“grow → sell → decorate → open a branch in another city”** is fun and repeatable on its own. Systems that do not improve this sequence are later enhancements, not prerequisites.

---

# Appendix A. Sample Quest — Flower Street

**Story:** Mia wants to turn a row of houses into a welcoming commercial street. The player places a home, connects a path, establishes a Grocery, grows Wheat and produces Bread. Dana asks for a supply shipment to her neighboring city. One shipment opens a franchise; a small shop sign appears in both cities and the player receives the cosmetic decoration **“The First Bench.”**

**Objective chain:** Place `B-001` → produce `GOOD_WHEAT:3` → produce `GOOD_BREAD:3` → supply `B-004` → collect Coins once → supply the NPC franchise once → claim one decoration.

**Rewards:** 300 Coins, 60 XP, one cosmetic Bench. **No failure:** After a week away, all progress remains intact. **Recovery:** If a home is sold, a replacement may be placed; if the player runs out of Goods, quest demand remains realistically achievable.

# Appendix B. Source Attribution and Design Assumptions

**Main source:** The user-supplied HTML research report “CityVille — What Worked, What Failed, and a GDD for a Modern Version.” It examines CityVille's launch/decline, the analyses of Tadhg Kelly, Goods, franchising, energy fatigue, monetization, live operations and an initial modern GDD. Its cited historical sources include Game Developer, GamesBeat, Eurogamer, AppData/AdWeek, Kotaku and GamesIndustry.biz. Their every historical figure has **not** been independently re-verified for this package.

**Derived from research:** Keep/Change/Remove reasoning, goods and city-building loop, the rejection of energy fatigue and social gates, mutually beneficial franchising, DAU/MAU design objective of at least 25%, and the 8–10-week prototype recommendation.

**New design assumptions:** Independent game branding, every building and goods table value, unlock progression, franchise split, palette, engine/server/schema, API, UI, event taxonomy, retention targets and asset specifications. All require implementation testing and player research; none are asserted to be historical CityVille mechanics or measurements.
