import { expect, test } from "@playwright/test";

test("showcase badges, level up, settings and target sizes", async ({ page }) => {
  await page.goto("/");
  for (const [id, name, role, color] of [["mia", "Mia", "Civic Engineer", "#2C9D8F"], ["dana", "Dana", "Merchant", "#D98669"], ["tom", "Tom", "Station Manager", "#3B8392"], ["amir", "Amir", "Gardener", "#5A9B79"]] as const) {
    const badge = page.getByTestId(`npc-badge-${id}`);
    await expect(badge).toContainText(name); await expect(badge).toContainText(role); await expect(badge).toContainText("NPC");
    await expect(badge.locator("circle").first()).toHaveAttribute("fill", color);
  }
  await page.getByTestId("vfx-trigger-levelup").click(); await expect(page.getByTestId("vfx-levelup")).toBeVisible();
  await page.getByTestId("vfx-levelup").click(); await expect(page.getByTestId("vfx-levelup")).toHaveCount(0);
  await page.getByTestId("vfx-trigger-levelup").click(); await expect(page.getByTestId("vfx-levelup")).toHaveCount(0, { timeout: 2200 });
  await page.getByTestId("toggle-music").click(); await page.getByTestId("toggle-sfx").click(); await page.reload();
  await expect(page.getByTestId("toggle-music")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("toggle-sfx")).toHaveAttribute("aria-pressed", "true");
  for (const element of await page.locator('button, [role="button"], a[href], input, select, textarea').all()) {
    if (await element.isVisible()) { const box = await element.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44); }
  }
});
test("reduced motion announces cues without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  await expect(page.getByTestId("reduced-motion")).toHaveText("reduce");
  await page.getByTestId("vfx-trigger-collect").click();
  await expect(page.getByTestId("fx-toast")).toHaveText("Coins collected");
  await expect(page.locator(".coin-flight")).toHaveCount(0);
});
