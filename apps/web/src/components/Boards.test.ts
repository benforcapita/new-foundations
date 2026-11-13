import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Snapshot } from "@nf/shared/schemas";
// The root test tsconfig does not enable JSX; Vite transforms the component.
// @ts-expect-error TS6142: component is TSX
import { FranchiseView, HqBadge, OrderBoard } from "./Boards";

describe("boards", () => {
  it("shows order counts, rewards, disabled fulfillment and cooldown", () => {
    const snapshot = { inventory: { GOOD_BREAD: 2 }, orders: [{ id: "o", slot: 0, status: "OPEN", templateId: "ORD-T-001", requirements: { GOOD_BREAD: 3 }, reward: { coins: 180, xp: 12, civicStars: 1 } }] } as unknown as Snapshot;
    const html = renderToStaticMarkup(createElement(OrderBoard, { snapshot, cooldown: 899, onFulfill: () => {}, onReroll: () => {} }));
    expect(html).toContain("2 / 3"); expect(html).toContain("180 Coins / 12 XP / 1 Civic Stars"); expect(html).toContain("14:59");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("shows HQ only when a branch is owned", () => {
    expect(renderToStaticMarkup(createElement(HqBadge, { owned: true }))).toContain("hq-badge");
    expect(renderToStaticMarkup(createElement(HqBadge, { owned: false }))).toBe("");
  });
  it("shows host, NPC, supply options and exact settlement", () => {
    const host = { cityId: "h", name: "Dana's City", npcKey: "dana_city", plots: [{ plotId: "1,2", x: 1, y: 2 }], requiredGoods: [{ goodId: "GOOD_BREAD", qty: 3 }], expectedCycleProfit: 110, splitBps: { owner: 6000, host: 4000 } };
    const branch = { state: "ACTIVE" } as Snapshot["franchises"][number];
    const html = renderToStaticMarkup(createElement(FranchiseView, { host, branch, cycles: 1, setCycles: () => {}, onRequest: () => {}, onSupply: () => {}, onCollect: () => {}, split: { ownerAmount: 66, hostAmount: 44, total: 110 }, busy: false }));
    for (const value of ["2×2 at 1, 2", "Bread", "110 Coins", "60% you / 40% Dana", "npc-badge-dana", "NPC", "2 cycles", "You: 66 / Dana: 44 / Total: 110"]) expect(html).toContain(value);
  });
});
