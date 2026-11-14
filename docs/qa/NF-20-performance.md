# NF-20 performance report

The benchmark exercises the Phaser canvas scene with a synthetic 96×96 grass map, 500 cottages and 30 ready badges. It pans back and forth and alternates zoom for 30 seconds, checking the visible building count at every step. Frame intervals measure vsync-limited FPS; frame work measures the time between Phaser's pre-step and post-render events. Placement measures local input to the next rendered frame.

The artifact records JS heap via Chromium CDP, the backing bytes of the main canvas, live terrain render textures and runtime atlas, and the sum of Chromium renderer RSS from Linux `/proc` for the browser's renderer processes. Canvas backing is width × height × 4 and excludes decoded PNGs and other browser allocations. Renderer RSS includes other allocations and can include more than the benchmark tab. These numbers overlap and must not be added together. The renderer metric requires Linux `/proc`.

Terrain chunks are created near the viewport and destroyed offscreen, instead of allocating all 64 at startup. The runtime atlas remains: Phaser Canvas does not batch its draws, and the atlas costs about 22 MiB; it has no demonstrated performance benefit and should be reconsidered. The 24×24 scene also uses lazy terrain chunks. This report does not establish its renderer memory independently.

## Local result

A local Linux Chromium run produced **59.80 average FPS**, **59.52 p5 FPS**, **3.60 ms average** and **4.80 ms p95** frame work, **13.11 MiB JS heap**, **62.72 MiB peak sampled canvas backing**, **265.36 MiB renderer RSS**, and **5 ms placement latency**. The 30 step samples had 23–26 visible buildings. The canvas and RSS are sampled during/after the pan rather than peak process memory. FPS is capped near 60 Hz; these are desktop results, not mobile results.

The Playwright test writes `nf20-benchmark.json` under its test output directory, uploaded in CI as `nf20-benchmark`. Run with `DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations_nf20 NF_E2E_WEB_PORT=4120 NF_E2E_API_PORT=3020 pnpm --filter @nf/web test:e2e e2e/nf20-bench.spec.ts` after the web build.

## Phase 2 recommendation

The sampled desktop renderer is below the cited 450 MB resident-memory budget, but it excludes other browser processes and is not a peak or mobile measurement. Treat the engine as a mobile risk until total resident memory, startup and pan spikes are profiled on representative low- and mid-range devices. The runtime atlas and chunk recreation remain memory and performance trade-offs. The 100 animated NPCs/vehicles, cold start and mobile device matrix are not covered by this benchmark.
