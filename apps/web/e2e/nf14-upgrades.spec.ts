import { expect, test } from "@playwright/test";

test("warehouse controls persist upgrades and collection priority", async ({ page }) => {
  await page.goto("/?e2e=1");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes");
  await page.getByRole("button", { name: /^Warehouse / }).click();
  const panel = page.getByTestId("warehouse-panel");
  await panel.getByRole("button", { name: "Upgrade warehouse" }).click();
  await expect(panel.getByTestId("warehouse-cap")).toHaveText("3/60");
  await panel.getByLabel("Collect priority").selectOption("OLDEST_FIRST");
  await expect(panel.getByLabel("Collect priority")).toHaveValue("OLDEST_FIRST");
  await page.reload();
  await page.getByRole("button", { name: /^Warehouse / }).click();
  await expect(page.getByTestId("warehouse-cap")).toHaveText("3/60");
  await expect(page.getByTestId("warehouse-panel").getByLabel("Collect priority")).toHaveValue("OLDEST_FIRST");
});

test("partial collection displays the localized warehouse full message", async ({ page }) => {
  await page.route("**/commands/collect-all", async route => {
    const response = await route.fetch();
    const json = await response.json();
    json.result = { ...json.result, collected: 3, remaining: 2, warehouseFull: true };
    await route.fulfill({ response, json });
  });
  await page.goto("/?e2e=1");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes");
  await page.getByTestId("collect-all").click();
  await expect(page.getByRole("status").filter({ hasText: "3 of 5 collected — Warehouse Full" })).toBeVisible();
});
