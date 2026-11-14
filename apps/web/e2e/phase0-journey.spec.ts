import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

async function target(page: Page) {
  await page.getByTestId("tutorial-target").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tutorial-target")).toBeVisible();
  const box = await page.getByTestId("tutorial-target").boundingBox();
  if (!box) throw new Error("Tutorial target missing");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test("new player completes the Phase 0 journey and resumes the same city", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await page.getByTestId("place-cottage").click();
  await target(page);
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-step")).toContainText("Wheat");
  await target(page);
  await page.getByTestId("details-collect").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-step")).toContainText("Select the Grocery");
  await target(page);
  await page.getByTestId("details-supply").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-step")).toContainText("selling");
  await page.evaluate(() => sessionStorage.setItem("nf_test_now", new Date(Date.now() + 11_000).toISOString()));
  await target(page);
  await page.getByTestId("details-collect").click();
  await expect(page.getByTestId("place-bakery")).toBeVisible();
  await page.getByTestId("place-bakery").click();
  await target(page);
  await expect(page.getByTestId("tutorial-root")).toHaveCount(0);
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await page.getByTestId("order-board-open").click();
  await page.getByTestId("order-card").filter({ hasText: "ORD-EASY-WHEAT" }).getByTestId("order-fulfill").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("order-card").filter({ hasText: "ORD-EASY-WHEAT" })).toHaveCount(0);
  await page.getByTestId("franchise-board-open").click();
  await page.getByTestId("franchise-request").click();
  await expect(page.getByTestId("franchise-board").getByTestId("franchise-branch")).toContainText("ACTIVE");
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  const token = await page.evaluate(() => localStorage.getItem("nf_session_token"));
  const snapshot = async (p: Page) => p.evaluate(async () => {
    const response = await fetch("/v1/cities/current", { headers: { Authorization: `Bearer ${localStorage.getItem("nf_session_token")}` } });
    if (!response.ok) throw new Error(`Snapshot failed: ${response.status}`);
    return response.json();
  });
  const before = await snapshot(page);
  const coins = await page.getByTestId("hud-coins").textContent();
  const xp = await page.getByTestId("hud-xp").textContent();
  expect(token).toBeTruthy();
  if (coins === null || xp === null) throw new Error("HUD missing");
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await expect(reopened.getByTestId("sync-status")).toHaveText("Synced");
  expect(await reopened.evaluate(() => localStorage.getItem("nf_session_token"))).toBe(token);
  await expect(reopened.getByTestId("hud-coins")).toHaveText(coins);
  await expect(reopened.getByTestId("hud-xp")).toHaveText(xp);
  const after = await snapshot(reopened);
  expect(after.city).toMatchObject({ cityId: before.city.cityId, coins: before.city.coins, xp: before.city.xp });
  await expect(reopened.getByTestId("tutorial-root")).toHaveCount(0);
  expect(after.quests).toEqual(before.quests);
  expect(after.orders).toEqual(before.orders);
  expect(after.franchises).toEqual(before.franchises);
  await reopened.getByTestId("franchise-board-open").click();
  await expect(reopened.getByTestId("franchise-board").getByTestId("franchise-branch")).toContainText("ACTIVE");
  await expect(reopened.getByRole("button", { name: /friends|payment|purchase|store/i })).toHaveCount(0);
  await expect(reopened.getByText(/add friends|payment|buy gems/i)).toHaveCount(0);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  for (const franchise of after.franchises as { id: string }[]) {
    if (!/^[0-9a-f-]{36}$/i.test(franchise.id)) throw new Error("Invalid franchise ID");
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `delete from franchises where id = '${franchise.id}'`]);
  }
});
