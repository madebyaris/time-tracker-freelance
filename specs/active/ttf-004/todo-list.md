# ttf-004 — Todo list

## Phase 1 — Wrangler foundation

- [x] T1.1 Upgrade Wrangler to v4 and refresh lockfile.
- [x] T1.2 Add Worker Static Assets config for `apps/web/dist`.
- [x] T1.3 Add `env.staging` and `env.production` with explicit non-inherited bindings.
- [x] T1.4 Add observability config and required secret declarations.
- [x] T1.5 Generate Worker binding types into `apps/api/src/worker-configuration.d.ts`.
- [x] T1.6 Add root/API scripts for check, types, local dev, dry-run deploy, deploy, and tail.
- [x] T1.7 Update `.gitignore` and env examples for `.dev.vars*`.

## Phase 2 — D1 migrations

- [x] T2.1 Create `packages/db/migrations/d1/0000_initial.sql`.
- [x] T2.2 Include `users`, `sessions`, and all sync tables used by the Worker store.
- [x] T2.3 Add sync indexes, especially `(user_id, updated_at)` where useful.
- [x] T2.4 Configure Wrangler `migrations_dir`.
- [x] T2.5 Remove or sharply limit request-time schema creation in `worker-store.ts`.

## Phase 3 — Worker/web integration

- [x] T3.1 Ensure `apps/web` builds before Cloudflare deploy.
- [x] T3.2 Serve the Vite SPA through Worker Static Assets.
- [x] T3.3 Route `/auth/*`, `/sync/*`, and `/health` through the Worker before assets.
- [x] T3.4 Make hosted web same-origin by default, without requiring a manual API URL.
- [x] T3.5 Preserve Node/Postgres local/self-host API path.

## Phase 4 — Web auth hardening

- [x] T4.1 Add `HttpOnly` cookie session support for web login.
- [x] T4.2 Keep bearer auth compatibility for desktop sync.
- [x] T4.3 Add `/auth/logout`.
- [x] T4.4 Update `/auth/me` to accept cookie session or bearer token.
- [x] T4.5 Replace web `localStorage` token flow with cookie-backed login state.
- [x] T4.6 Add registration gating (`first-user-only` or env-controlled registration).

## Phase 5 — Security and DX polish

- [x] T5.1 Tighten CORS for production and local desktop/web dev origins.
- [x] T5.2 Add CSP and security headers for hosted web responses.
- [x] T5.3 Add safe structured logging without tokens, cookies, passwords, or full sync payloads.
- [x] T5.4 Write `docs/deploy-cloudflare.md` or README deployment section.
- [x] T5.5 Add a deploy preflight checklist.

## Phase 6 — Verification

- [x] T6.1 `pnpm typecheck`.
- [x] T6.2 `pnpm --filter @ttf/web build`.
- [x] T6.3 `pnpm --filter @ttf/api typecheck`.
- [x] T6.4 `pnpm cf:check` (Wrangler v4 dry-run validation).
- [x] T6.5 `wrangler types --check`.
- [x] T6.6 Apply D1 migrations locally.
- [x] T6.7 Dry-run staging deploy.
- [x] T6.8 Manual E2E: web register/login/logout, cookie `/auth/me`, sync pull, desktop bearer sync push/pull.

## Progress log

| When | What |
|---|---|
| 2026-04-27 | Planned Cloudflare deployability and web auth hardening scope from SDD planner research. |
| 2026-04-27 | Implemented Worker Static Assets, D1 migrations, cookie sessions, docs, scripts, and verification. |
