import { and, eq } from "drizzle-orm";
import { QUESTS, type QuestDefinition } from "@nf/shared";
import { cities, quests } from "../db/schema";
import type { CommandContext } from "../plugins/idempotency";

type Event = { readonly name: string; readonly payload: Record<string, unknown> };

export async function progressQuests(ctx: CommandContext, cityId: string, event: Event): Promise<void> {
  const rows = await ctx.tx.select().from(quests).where(eq(quests.cityId, cityId));
  for (const row of rows) {
    if (row.status !== "ACTIVE") continue;
    const definition = QUESTS.find((item) => item.id === row.questId);
    const step = definition?.steps[row.stepIndex];
    if (step === undefined) continue;
    const progress = advanceQuestStep(step, row.stepState, row.stepIndex, event);
    if (progress === null) continue;
    const { state, index } = progress;
    const completed = index >= (definition?.steps.length ?? 0);
    await ctx.tx.update(quests).set({ stepState: state, stepIndex: index, status: completed ? "COMPLETED" : "ACTIVE", completedAt: completed ? ctx.now : null, version: ctx.versionAfter }).where(and(eq(quests.cityId, cityId), eq(quests.questId, row.questId), eq(quests.periodKey, row.periodKey)));
    if (completed) {
      row.status = "COMPLETED";
      if (row.questId === "quest_tutorial_bakery") await ctx.tx.update(cities).set({ tutorialState: { step: "tutorial_core_complete", guideNpcId: "NPC-MIA" } }).where(eq(cities.id, cityId));
    }
  }
  for (const definition of QUESTS) {
    if (rows.some((row) => row.questId === definition.id) || definition.prerequisites.length === 0 || !definition.prerequisites.every((id) => rows.some((row) => row.questId === id && (row.status === "COMPLETED" || row.status === "CLAIMED")))) continue;
    await ctx.tx.insert(quests).values({ cityId, questId: definition.id, periodKey: "-", track: definition.track, status: "ACTIVE", stepIndex: 0, stepState: Object.fromEntries(definition.steps.map((_, index) => [String(index), 0])), startedAt: ctx.now, version: ctx.versionAfter }).onConflictDoNothing();
  }
}

export function advanceQuestStep(step: QuestDefinition["steps"][number], previous: Readonly<Record<string, number>>, index: number, event: Event): { state: Record<string, number>; index: number } | null {
  if (step.event !== event.name) return null;
  const matches = Object.entries(step.filter).every(([key, expected]) => {
    const actual = key === "building_definition_id" ? event.payload.definitionId : key === "host_city_id" ? event.payload.hostNpcId : key === "good_id" ? event.payload.goodId : event.payload[key];
    return actual === expected;
  });
  if (!matches) return null;
  const state = { ...previous, [String(index)]: Math.min(step.amount, (previous[String(index)] ?? 0) + 1) };
  return { state, index: (state[String(index)] ?? 0) >= step.amount ? index + 1 : index };
}
