import { expect, test } from "@playwright/test";

test("shell renders the game title and canvas", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { name: "New Foundations" })).toBeVisible();
  await expect(page.getByTestId("game-canvas").locator("canvas")).toBeVisible();
});
