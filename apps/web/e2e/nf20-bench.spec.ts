import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { BENCH_DURATION_MS } from "../../../tools/bench/scene";

test("96×96 stress city maintains 30 p5 FPS", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/?demo=1&bench=1");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 60_000 });
  await expect(page.getByTestId("map-size")).toHaveText("96x96");
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-bench-stats", /.+/);
  const stats = JSON.parse((await page.getByTestId("game-canvas").getAttribute("data-bench-stats")) ?? "{}");
  expect(stats).toMatchObject({ buildings: 500, readyBadges: 30, atlasBuildings: 500 });
  expect(stats.visibleBuildings).toBeGreaterThan(0);
  expect(stats.visibleBuildings).toBeLessThan(500);
  const frames = page.evaluate((duration) => new Promise<number[]>((resolve) => {
    const samples: number[] = [];
    let start = 0;
    let previous = 0;
    const frame = (now: number) => {
      if (!start) start = now;
      if (previous) samples.push(now - previous);
      previous = now;
      if (now - start < duration) requestAnimationFrame(frame);
      else resolve(samples);
    };
    requestAnimationFrame(frame);
  }), BENCH_DURATION_MS);
  const canvas = page.getByTestId("game-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  const steps: { visibleBuildings: number; canvasBackingBytes: number }[] = [];
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + (i % 2 ? -140 : 140), box.y + box.height / 2 + (i % 2 ? -80 : 80), { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, i % 2 ? -100 : 100);
    await page.waitForTimeout(700);
    const current = JSON.parse((await page.getByTestId("game-canvas").getAttribute("data-bench-stats")) ?? "{}");
    expect(current.visibleBuildings).toBeGreaterThan(1);
    expect(current.canvasBackingBytes).toBeLessThan(100 * 1024 * 1024);
    steps.push({ visibleBuildings: current.visibleBuildings, canvasBackingBytes: current.canvasBackingBytes });
  }
  expect(new Set(steps.map((step) => step.visibleBuildings)).size).toBeGreaterThan(1);
  const samples = await frames;
  const sorted = samples.map((ms) => 1000 / ms).sort((a, b) => a - b);
  const avg = 1000 * samples.length / samples.reduce((a, b) => a + b, 0);
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const cdp = await page.context().newCDPSession(page);
  const heap = await cdp.send("Runtime.getHeapUsage");
  const browser = page.context().browser();
  if (!browser) throw new Error("browser missing");
  const browserSession = await browser.newBrowserCDPSession();
  const processes = await browserSession.send("SystemInfo.getProcessInfo");
  const rendererRss = await Promise.all(processes.processInfo.filter((process) => process.type === "renderer").map(async (process) => {
    const status = await readFile(`/proc/${process.id}/status`, "utf8");
    return Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
  }));
  const finalStats = JSON.parse((await page.getByTestId("game-canvas").getAttribute("data-bench-stats")) ?? "{}");
  const work = (finalStats.frameWork as number[]).slice().sort((a, b) => a - b);
  await page.getByTestId("place-cottage").click();
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2 + 1);
  await expect(page.getByTestId("ghost-tone")).not.toHaveText("idle");
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-placement-latency", /^(?:0|[1-9]\d*)$/);
  const latencyMs = Number(await page.getByTestId("game-canvas").getAttribute("data-placement-latency"));
  expect(latencyMs).toBeLessThanOrEqual(100);
  const report = { avgFps: avg, p5Fps: p5, heapUsedBytes: heap.usedSize, placementLatencyMs: latencyMs, samples: samples.length, frameWorkAvgMs: work.reduce((a, b) => a + b, 0) / work.length, frameWorkP95Ms: work[Math.floor(work.length * 0.95)], canvasBackingBytes: Math.max(...steps.map((step) => step.canvasBackingBytes)), rendererRssBytes: rendererRss.reduce((a, b) => a + b, 0), steps };
  console.log(JSON.stringify(report));
  await writeFile(testInfo.outputPath("nf20-benchmark.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("nf20-benchmark.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(p5).toBeGreaterThanOrEqual(30);
});


test("culling responds to zoom while the camera stays in place", async ({ page }) => {
  await page.goto("/?demo=1&bench=1");
  const host = page.getByTestId("game-canvas");
  await expect(host).toHaveAttribute("data-bench-stats", /.+/, { timeout: 60_000 });
  const canvas = host.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(50); }
  await page.waitForTimeout(200);
  const zoomedIn = JSON.parse((await host.getAttribute("data-bench-stats")) ?? "{}").visibleBuildings as number;
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(50); }
  await page.waitForTimeout(200);
  const zoomedOut = JSON.parse((await host.getAttribute("data-bench-stats")) ?? "{}").visibleBuildings as number;
  expect(zoomedIn).toBeGreaterThan(1);
  expect(zoomedOut).toBeGreaterThan(zoomedIn);
});
