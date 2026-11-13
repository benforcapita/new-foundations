# New Foundations

Monorepo for the New Foundations client and API. This tree is the NF-1 scaffold: pnpm workspaces, strict TypeScript, ESLint, Vitest, Playwright, and a PostgreSQL 16 service for API integration tests.

## Prerequisites

- Node.js 22
- pnpm 10.33.4 (`corepack enable && corepack prepare pnpm@10.33.4 --activate`)
- Docker, for the local database

## Local run

```bash
docker compose up db
pnpm install
pnpm dev
```

`docker compose up db` starts PostgreSQL 16. `pnpm dev` starts the Vite client and the Fastify API together.

- Web: http://localhost:5173
- API health: http://localhost:3001/health

Copy `.env.example` if you want the integration-test URL handy:

```bash
export DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations
```

The API `/health` route does not need the database. The integration test does.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm --filter @nf/web build
pnpm --filter @nf/web exec playwright install --with-deps chromium
pnpm --filter @nf/web test:e2e
```

Run the Vite build before the Playwright smoke test. The smoke test serves `apps/web` with `vite preview`.

## Layout

- `apps/web` — React 19, TypeScript, Vite, Zustand, Phaser 3
- `apps/api` — Fastify, Drizzle, PostgreSQL 16
- `packages/shared` — types shared by the client and the API
- `assets/` — starter bundle. The files are not in this commit yet. See `assets/README.md`.
- `docs/` — `GDD_New_Foundations_EN.md` lands here with the bundle. See `docs/README.md`.

## Asset checksums

`pnpm test:unit` includes `tests/asset-checksums.test.ts`. The starter-bundle check reads `assets/CHECKSUMS.sha256` and compares each listed file byte for byte. It skips, and prints why, only when that manifest is missing. The engineering lead commits the bundle and the manifest onto this branch; nothing in the repo generates art or a stand-in manifest.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, API integration tests against a `postgres:16` service, the Vite build, and the Playwright smoke test.
