import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { BENCH_DURATION_MS } from "../../../tools/bench/scene";

test("96×96 stress city maintains 30 p5 FPS", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/?demo=1&bench=1");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 60_000 });
  await expect(page.getByTestId("map-size")).toHaveText("96x96");
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-bench-stats", /.+/);
  const stats = JSON.parse((await page.getByTestId("game-canvas").getAttribute("data-bench-stats")) ?? "{}");
  expect(stats).toMatchObject({ buildings: 500, readyBadges: 30, atlasBuildings: 500, terrainChunks: 64 });
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
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + (i % 2 ? -140 : 140), box.y + box.height / 2 + 80, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, i % 2 ? -100 : 100);
    await page.waitForTimeout(700);
  }
  const samples = await frames;
  const sorted = samples.map((ms) => 1000 / ms).sort((a, b) => a - b);
  const avg = 1000 * samples.length / samples.reduce((a, b) => a + b, 0);
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const cdp = await page.context().newCDPSession(page);
  const heap = await cdp.send("Runtime.getHeapUsage");
  await page.getByTestId("place-cottage").click();
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2 + 1);
  await expect(page.getByTestId("ghost-tone")).not.toHaveText("idle");
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-placement-latency", /^(?:0|[1-9]\d*)$/);
  const latencyMs = Number(await page.getByTestId("game-canvas").getAttribute("data-placement-latency"));
  expect(latencyMs).toBeLessThanOrEqual(100);
  const report = { avgFps: avg, p5Fps: p5, heapUsedBytes: heap.usedSize, placementLatencyMs: latencyMs, samples: samples.length };
  console.log(JSON.stringify(report));
  await writeFile(testInfo.outputPath("nf20-benchmark.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("nf20-benchmark.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(p5).toBeGreaterThanOrEqual(30);
});
