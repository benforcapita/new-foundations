# Deployment preparation

**No production deploy without Ben's written OK.** These are operator instructions; this repository does not deploy automatically.

## Railway API

Create a Railway service from the monorepo with the repository root as the build context, and set the configuration file path to `/apps/api/railway.toml`. The Dockerfile installs the API and shared workspace from the lockfile. Configure `DATABASE_URL` using the service's PostgreSQL connection string, `CORS_ORIGINS` as a comma-separated list of the Vercel production and preview origins (including custom domains), and `SESSION_PEPPER` as a securely generated secret stored only in Railway. `CORS_ORIGIN` remains a legacy fallback. Railway supplies `PORT`; set `HOST` to `0.0.0.0`.

The pre-deploy command runs `pnpm --filter @nf/api migrate`; migrations also run idempotently on boot before NPC seeding. The service starts with `pnpm --filter @nf/api start` and Railway checks `/healthz`, which reports database availability. Verify the health response after an authorized preview deployment.

Set the pepper before creating accounts and keep it stable across releases and replicas. Adding, removing, or rotating it invalidates existing session tokens and recovery codes; it also changes command request hashes, so existing idempotency keys must not be replayed across that change. An unset pepper preserves the existing SHA-256 behavior for local development and tests. Never expose this value to the client.

## Vercel web

Create a new Vercel site from the monorepo and set its root directory to `apps/web`. Use the repository's pnpm install and the configured Vite build; Vite outputs `dist`. Set `VITE_API_URL` for each intended environment to the Railway API origin, without a trailing path. This is the only client environment variable and is public in the client bundle. The SPA rewrite serves `index.html` for client routes. The current client does not yet call the API; NF-7 wires that separately.

For an authorized preview, configure preview environment variables and deploy through the provider dashboards, then check the web site and API health, including CORS for the preview origin. Add the eventual production and any custom origins to `CORS_ORIGINS`. Do not promote or deploy production without Ben's written OK.
