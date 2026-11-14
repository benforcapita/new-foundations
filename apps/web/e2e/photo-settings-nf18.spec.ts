import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes");
  await expect(page.getByTestId("sync-status")).toHaveText("Synced ");
}
test("photo mode hides and restores HUD and exports a PNG", async ({ page }) => {
  await ready(page);
  await page.getByTestId("photo-mode-button").click();
  await expect(page.getByTestId("hud-coins")).toBeHidden();
  const scene = (await page.locator("[data-testid=game-canvas] canvas").screenshot()).toString("base64");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("photo-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^new-foundations-\d{4}-\d\d-\d\d\.png$/);
  const path = await download.path();
  const exported = (await readFile(path)).toString("base64");
  const comparison = await page.evaluate(async ([a, b]) => {
    const load = (data: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = `data:image/png;base64,${data}`; });
    const [photo, original] = await Promise.all([load(a ?? ""), load(b ?? "")]);
    const pixels = (image: HTMLImageElement, width: number, height: number) => { const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas unavailable"); ctx.drawImage(image, 0, 0, width, height); return ctx.getImageData(0, 0, width, height).data; };
    const first = pixels(photo, original.width, original.height), second = pixels(original, original.width, original.height);
    let difference = 0, count = 0;
    for (let y = 0; y < Math.min(40, original.height); y++) for (let x = 0; x < Math.min(200, original.width); x++) for (let c = 0; c < 3; c++) { const i = (y * original.width + x) * 4 + c; difference += Math.abs((first[i] ?? 0) - (second[i] ?? 0)); count++; }
    return { width: photo.width / original.width, height: photo.height / original.height, difference: difference / count };
  }, [exported, scene]);
  expect(comparison.width).toBe(2); expect(comparison.height).toBe(2); expect(comparison.difference).toBeLessThan(10);
  await page.keyboard.press("p");
  await expect(page.getByTestId("hud-coins")).toBeVisible();
});
test("building list opens details and settings persist with double reset", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Building List", exact: true }).click();
  const row = page.getByTestId("building-list").locator("button[data-testid^=building-list-row-]").first();
  await expect(row).toContainText(/Idle|Ready|Producing|Needs supply|construction|Upgrading|Relocating/);
  const beforeCamera = await page.getByTestId("camera-scroll").innerText();
  await row.click();
  await expect(page.getByTestId("building-details")).toBeVisible();
  await expect(page.getByTestId("camera-scroll")).not.toHaveText(beforeCamera);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByTestId("settings-music").click();
  await page.getByTestId("settings-collect-priority").selectOption("production");
  for (const id of ["settings-reduced-motion", "settings-music", "settings-sfx", "settings-collect-priority", "settings-recovery-code", "settings-export-json", "settings-reset"]) {
    const box = await page.getByTestId(id).boundingBox(); expect(box && box.width >= 44 && box.height >= 44).toBeTruthy();
  }
  await page.getByTestId("settings-reset").click();
  await expect(page.getByTestId("settings-reset-confirm-1")).toBeVisible();
  await expect(page.getByTestId("settings-reset-confirm-2")).toHaveCount(0);
  const cityBefore = await page.evaluate(() => localStorage.getItem("nf_session_token"));
  expect(cityBefore).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("scene-ready")).toHaveText("yes");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("settings-music")).toContainText("Off");
  await expect(page.getByTestId("settings-collect-priority")).toHaveValue("production");
  expect(await page.evaluate(() => localStorage.getItem("nf_session_token"))).toBe(cityBefore);
  await page.getByTestId("settings-reset").click();
  await page.getByTestId("settings-reset-confirm-1").click();
  await page.getByTestId("settings-reset-confirm-2").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nf_session_token"))).not.toBe(cityBefore);
});
test("recovery code restores the same city in another context", async ({ page, browser }) => {
  await ready(page);
  const coins = await page.getByTestId("hud-coins").innerText();
  const buildings = await page.getByTestId("city-building").allTextContents();
  const code = await page.evaluate(() => localStorage.getItem("nf_recovery_code"));
  expect(code).toBeTruthy();
  const context = await browser.newContext();
  const second = await context.newPage();
  await ready(second);
  await second.getByRole("button", { name: "Settings", exact: true }).click();
  await second.getByTestId("settings-recovery-code").click();
  await second.getByLabel("Restore a city").fill(code ?? "");
  await second.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(second.getByTestId("scene-ready")).toHaveText("yes");
  await expect(second.getByTestId("hud-coins")).toHaveText(coins);
  await expect(second.getByTestId("city-building")).toHaveText(buildings);
  await context.close();
});
