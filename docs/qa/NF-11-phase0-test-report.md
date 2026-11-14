# NF-11 Phase 0 test report

The browser journey uses the live API and a new guest city. Test-only server time advances the tutorial sale; no demo mode or animation-frame sleeps are used. API tests use a controlled server clock and reconcile test setup grants in the ledger.

| Phase 0 DoD / resilience item | Evidence |
| --- | --- |
| New player completes tutorial, fulfills an order, starts an NPC franchise and reopens with the same token; coins, XP, quests, orders and branch persist; friends and payment UI absent | `apps/web/e2e/phase0-journey.spec.ts` — `new player completes the Phase 0 journey and resumes the same city` |
| Every city command replays ten times with one effect, including placement, movement, removal, collection, production, supply, expansion, reroll and quest claim | `apps/api/src/test/integration/phase0-resilience.integration.test.ts` — `each city command replays ten times without changing balances, ledger, or version` |
| Order fulfillment and franchise request, supply and collect replay ten times; supply survives disconnection, retry and session resume | Same integration file — `order and franchise commands survive replay and a disconnected session` |
| Client clock cannot accelerate server timers | Same integration file — `client clock headers cannot accelerate server production` |
| Starter, NPC and command-sequence cities reconcile ledger to currencies and inventory | Same integration file — `starter and every seeded NPC city reconcile ledger to all balances`; each command, recovery and production scenario also reconciles its cities |
| Zero coins and empty warehouse yield a solvable recovery order and allow building again | Same integration file — `zero coins and an empty warehouse recover through a harvested order` |
| Full warehouse at production completion preserves output | Same integration file — `production completing with a full warehouse retains its entire output` |

## Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test:unit` | 152 passed, 0 failed |
| `DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations_nf11 pnpm test:integration` | 53 passed, 0 failed |
| `pnpm --filter @nf/web build` | Pass |
| `NF_E2E_API_PORT=3011 NF_E2E_WEB_PORT=4111 DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations_nf11 pnpm --filter @nf/web exec playwright test --retries=0 --repeat-each=3` | 84 passed, 0 failed (28 tests × 3) |
