# ttf-004 — Progress

## Status: shipped

All six phases of the [todo list](todo-list.md) are implemented and verified.

## Research Summary

The repo already has most of the pieces required for a hosted Cloudflare path:

- Vite web dashboard in `apps/web`.
- Hono API with Worker entry in `apps/api/src/worker.ts`.
- Node/Postgres local path.
- Worker/D1 store path.
- Existing Wrangler config under `infra/wrangler/wrangler.jsonc`.

The deploy path is not yet production-ready because Wrangler config is minimal, web assets are not deployed with the Worker, D1 schema setup is request-time, and browser login stores bearer tokens in `localStorage`.

## Recommended Direction

Use a single Cloudflare Worker with Static Assets:

- Serve `apps/web/dist` from the Worker.
- Run Hono API paths (`/auth/*`, `/sync/*`, `/health`) through the Worker.
- Back hosted data with D1.
- Keep Node/Postgres as local/self-host path.
- Use cookie sessions for hosted web login.
- Keep bearer auth for desktop sync.

## Key Decisions

- **Worker Static Assets over Cloudflare Pages**: one deploy config, same-origin auth, less CORS complexity.
- **D1 migrations over request-time schema creation**: deployment failures should happen during deploy/preflight, not first user request.
- **Cookie sessions for web**: avoid `localStorage` bearer tokens in the browser.
- **Bearer compatibility for desktop**: keep current desktop sync model working.
- **No extra Cloudflare services yet**: KV, R2, Queues, Durable Objects, Workflows, and Hyperdrive are not needed for the first simple deploy path.

## Verification Target

- `wrangler check` and `wrangler types --check` pass.
- D1 migrations apply locally and remotely.
- The hosted web app works without manually entering an API URL.
- Web login uses an `HttpOnly` cookie.
- Desktop sync still works with bearer auth.
- A dry-run deploy succeeds before real staging deploy.

## What Landed

### Phase 1 — Wrangler foundation

- Upgraded `wrangler` to v4.
- Reworked `infra/wrangler/wrangler.jsonc` for Worker Static Assets, staging/production environments, D1 bindings, required secrets, observability, and generated types.
- Added root/API Cloudflare scripts for type generation/checks, local dev, D1 migrations, dry-run deploy, staging deploy, and tailing logs.
- Added `.dev.vars.example` and ignored all `.dev.vars*` files except the example.

### Phase 2 — D1 migrations

- Added `packages/db/migrations/d1/0000_initial.sql`.
- Included `users`, `sessions`, all sync tables, and sync-friendly indexes.
- Removed request-time schema setup from the Worker store; D1 schema is now migration-driven.

### Phase 3 — Worker/web integration

- Configured the Worker to serve `apps/web/dist` through Worker Static Assets.
- Routed API paths through Hono while falling back to assets for the SPA.
- Made the web app use same-origin API calls by default.
- Preserved the Node/Postgres backend path.

### Phase 4 — Web auth hardening

- Added `HttpOnly` cookie sessions for browser login/register.
- Added `/auth/logout`.
- Updated auth middleware so `/auth/me` and sync routes accept either Bearer tokens or cookie sessions.
- Kept Bearer tokens in auth responses for desktop sync compatibility.
- Removed browser `localStorage` auth-token storage from the web dashboard.
- Added registration gating via `REGISTRATION_MODE`.

### Phase 5 — Security and DX polish

- Tightened default CORS origins.
- Added baseline security headers.
- Added safe structured request logging without payloads, cookies, or tokens.
- Added `docs/deploy-cloudflare.md`.
- Updated `README.md` Cloudflare scripts and spec references.

### Phase 6 — Verification

- `pnpm --filter @ttf/api typecheck` — clean.
- `pnpm --filter @ttf/web build` — clean, with the existing Vite chunk-size warning.
- `pnpm cf:check` — dry-run Worker deploy validation passes.
- `pnpm cf:types:check` — generated Worker types are up to date.
- `pnpm cf:migrate:local` — D1 migration applied locally.
- `pnpm cf:deploy:dry` — staging dry-run deploy passes.
- `pnpm typecheck` — clean across the workspace.
- `pnpm lint` — clean.
- Local Worker smoke tests passed for health, cookie register/login/logout, cookie `/auth/me`, cookie sync pull, Bearer sync pull, and Bearer sync push.

## Changelog

### 2026-04-27 - Implementation: Cloudflare Deployability Completed

**Context**: The user requested `/sdd-implementation` for `ttf-004` until done.

**Change**: Implemented the Cloudflare Worker Static Assets path, migration-driven D1 setup, cookie web sessions, Bearer-compatible auth middleware, deploy scripts, docs, and verification.

**Impact**: Tickr now has a concrete future deploy path for web + API on one Cloudflare Worker backed by D1. Real remote deployment still requires replacing placeholder D1 IDs and setting Wrangler secrets.

**Decision**: Use `pnpm cf:check` as the Wrangler v4 validation path because the old bare `wrangler check` command no longer performs config validation.

### 2026-04-27 - Refinement: SDD Planning Format Alignment

**Context**: The user invoked `/sdd-planning of ttf-004` after the initial research pass.

**Change**: Refined `plan.md` to align with the SDD planning output format by adding component dependencies, technology rationale, and explicit performance targets.

**Impact**: The plan is ready to feed into task expansion and implementation.

**Decision**: Keep `ttf-004` in planned status; no infra implementation files are changed by this planning pass.

### 2026-04-27 - Addition: Deployment Planning

**Context**: The user wants a future dead-simple deployment path for the website and backend.

**Change**: Added `ttf-004` planning package for Cloudflare deployability, Wrangler configuration, D1 migrations, web login hardening, security, and DX.

**Impact**: Future implementation has a focused SDD plan and todo list.

**Decision**: Plan for one Worker serving both web static assets and API routes, with D1 and same-origin web auth.
