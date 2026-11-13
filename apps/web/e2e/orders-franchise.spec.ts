import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("fulfills the starter order once and replaces it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await expect(page.getByTestId("hud-coins")).toHaveText("Coins: 750");
  await page.getByTestId("order-board-open").click();
  const starter = page.getByTestId("order-card").filter({ hasText: "ORD-T-001" });
  await starter.getByTestId("order-fulfill").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("hud-coins")).toHaveText("Coins: 930");
  await expect(page.getByTestId("hud-xp")).toContainText("XP: 12");
  await expect(page.getByTestId("order-card")).toHaveCount(3);
  await expect(starter).toHaveCount(0);
});

test("requests, supplies and settles Dana's branch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  const cityId = await page.evaluate(async () => {
    const token = localStorage.getItem("nf_session_token");
    const response = await fetch("/v1/cities/current", { headers: { Authorization: `Bearer ${token}` } });
    return ((await response.json()) as { city: { cityId: string } }).city.cityId;
  });
  if (!/^[0-9a-f-]{36}$/i.test(cityId)) throw new Error("Invalid city ID");
  execFileSync("psql", [process.env.DATABASE_URL ?? "", "-v", "ON_ERROR_STOP=1", "-c", `update inventory_balances set qty = 6 where city_id = '${cityId}' and good_id = 'GOOD_BREAD'`]);
  try {
  await page.getByTestId("franchise-board-open").click();
  await page.getByTestId("franchise-request").click();
  await expect(page.getByTestId("franchise-board").getByTestId("franchise-branch")).toContainText("ACTIVE");
  await expect(page.getByTestId("hq-badge")).toBeVisible();
  await page.getByTestId("franchise-supply-cycles").selectOption("2");
  const supplied = page.waitForResponse(response => response.url().endsWith("/supply") && response.request().method() === "POST");
  await page.getByTestId("franchise-supply").click();
  const supplyResponse = await supplied;
  expect(supplyResponse.request().postDataJSON()).toEqual({ cycles: 2 });
  expect(supplyResponse.ok()).toBe(true);
  expect(await supplyResponse.json()).toMatchObject({ result: { cycles: 2 } });
  await expect(page.getByTestId("franchise-supply")).toBeEnabled();
  await page.evaluate(() => sessionStorage.setItem("nf_test_now", new Date(Date.now() + 91 * 60_000).toISOString()));
  await page.getByTestId("franchise-collect").click();
  await expect(page.getByTestId("franchise-split")).toHaveText("You: 132 / Dana: 88 / Total: 220");
  } finally {
    const ids = await page.evaluate(async () => {
      const token = localStorage.getItem("nf_session_token");
      if (!token) return [];
      const response = await fetch("/v1/cities/current", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as { franchises: { id: string }[] };
      return data.franchises.map(f => f.id);
    });
    for (const id of ids.filter(value => /^[0-9a-f-]{36}$/i.test(value))) {
      execFileSync("psql", [process.env.DATABASE_URL ?? "", "-v", "ON_ERROR_STOP=1", "-c", `delete from franchises where id = '${id}'`]);
    }
  }
});


test("reroll sends a command and maintains a ticking 15-minute cooldown", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await page.getByTestId("order-board-open").click();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let arrived!: () => void;
  const requestArrived = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("**/reroll-order", async route => { arrived(); await held; await route.continue(); });
  await page.getByTestId("order-reroll").first().click();
  await requestArrived;
  await expect(page.getByTestId("order-reroll").first()).toBeDisabled();
  await expect(page.getByTestId("order-reroll-cooldown")).toHaveText("Free reroll in 15:00");
  release();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await page.reload();
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await page.getByTestId("order-board-open").click();
  await expect(page.getByTestId("order-reroll").first()).toBeDisabled();
  await expect(page.getByTestId("order-reroll-cooldown")).toHaveText("Free reroll in 15:00");
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId("order-reroll-cooldown")).toHaveText("Free reroll in 13:59");
  await expect(page.getByTestId("order-reroll").first()).toBeDisabled();
});

test("fulfill emits coin and XP feedback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-fx-arcs", "0");
  await page.evaluate(() => {
    document.body.dataset.testCues = "";
    window.addEventListener("nf-fx", event => { document.body.dataset.testCues += `${(event as CustomEvent<string>).detail},`; });
  });
  await page.getByTestId("order-board-open").click();
  await page.getByTestId("order-card").filter({ hasText: "ORD-T-001" }).getByTestId("order-fulfill").click();
  await expect(page.locator("body")).toHaveAttribute("data-test-cues", "collect,xp,");
});

test("fulfill announces feedback with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await page.getByTestId("order-board-open").click();
  await page.getByTestId("order-card").filter({ hasText: "ORD-T-001" }).getByTestId("order-fulfill").click();
  await expect(page.getByTestId("fx-toast")).toHaveText("Order fulfilled");
});
