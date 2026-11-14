# NF-20 performance report

The benchmark runs the actual Phaser canvas scene in Chromium with a synthetic 96×96 grass map, 500 cottages and 30 ready badges. It pans and zooms for 30 seconds, samples animation-frame intervals, and measures the client-local placement ghost through the next rendered frame. FPS p5 is the fifth percentile of instantaneous frame rates; average FPS is frames divided by elapsed time. JS heap comes from Chromium's `Runtime.getHeapUsage` and excludes canvas backing stores and other process memory.

The Playwright test writes `nf20-benchmark.json` into its test output directory and CI uploads it as `nf20-benchmark`. Local run: `DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations_nf20 NF_E2E_WEB_PORT=4120 NF_E2E_API_PORT=3020 pnpm --filter @nf/web test:e2e e2e/nf20-bench.spec.ts` after the web build.

## Local result

On the local Linux Chromium run, 1,801 frame intervals produced **60.00 average FPS** and **59.52 p5 FPS**; JS heap used was **10,234,356 bytes (9.76 MiB)** and the placement ghost reached a rendered frame in **2 ms**. The test asserts p5 ≥30 FPS and placement latency ≤100 ms, and verifies the scene counts and that offscreen buildings are filtered. These figures are one desktop run, not a mobile result.

## Phase 2 recommendation

Treat the web engine as a mobile risk until tested on representative lower-end and midrange devices. Desktop Chromium results cannot establish the GDD's mobile frame-rate or 450 MB resident-memory budgets. In particular, JS heap excludes the canvas backing memory for 64 terrain chunks and the atlas. Profile resident memory, startup and pan spikes on real devices before committing to a native wrapper or choosing the Phase 2 engine. The GDD's 100 animated NPCs/vehicles, cold start, and mobile device matrix are not covered by this benchmark.
