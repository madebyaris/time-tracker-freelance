# ttf-004 — Cloudflare deployability + web auth hardening

## Summary

Make Tickr dead-simple to deploy in the future by finishing the Cloudflare/Wrangler path for the website and API. The preferred target is one Cloudflare Worker that serves the Vite web dashboard as static assets and runs the Hono API on `/auth/*`, `/sync/*`, and `/health`, backed by D1.

## Status

- **Spec**: shipped — see [plan.md](plan.md), [todo-list.md](todo-list.md), and [progress.md](progress.md)
- **Implementation**: shipped
- **Depends on**: shipped ttf-001 sync/API/web foundation, shipped ttf-002 client model, shipped ttf-003 invoice PDF work

## Goals

- Create a boring, repeatable future deploy path for the hosted website and API.
- Keep the hosted web dashboard and API on the same origin to simplify auth and remove unnecessary CORS complexity.
- Move D1 setup from request-time schema mutation to explicit migrations.
- Harden web login by avoiding `localStorage` bearer tokens for browser sessions.
- Preserve desktop sync compatibility with bearer/API-token style auth.
- Improve developer experience with clear scripts, env examples, generated Worker types, dry-run checks, and deployment docs.

## Non-goals

- No Tauri updater, desktop signing, or app distribution work.
- No multi-tenant teams/orgs.
- No Cloudflare Pages project unless Worker Static Assets proves insufficient.
- No KV, R2, Queues, Durable Objects, Workflows, Hyperdrive, or external Postgres for the default Cloudflare path.
- No magic-link email flow until an email provider is chosen.
- No external OAuth stack unless identity needs grow beyond a simple self-hosted account model.

## Recommended Direction

Use **Cloudflare Workers Static Assets + D1** as the default hosted deployment:

- `apps/web` builds to `apps/web/dist`.
- `apps/api/src/worker.ts` remains the Worker entry.
- `infra/wrangler/wrangler.jsonc` becomes the single deploy source of truth.
- API paths run through the Worker first.
- All other paths serve the SPA with single-page app fallback.

This keeps the web dashboard and API same-origin, which enables secure `HttpOnly` cookie sessions for the web while keeping bearer auth for desktop sync.

## Changelog

### 2026-04-27 - Addition: Cloudflare Deploy Planning

**Context**: The repo has a Worker/D1 path and a web dashboard, but Wrangler config and deployment docs are not yet production-ready. Web login currently stores bearer tokens in `localStorage`.

**Change**: Planned `ttf-004` as a Cloudflare-first deployability and web auth hardening feature.

**Impact**: Future implementation can focus on a small set of infra changes instead of broad platform exploration.

**Decision**: Prefer one Worker serving both static web assets and the API, backed by D1, with explicit migrations and cookie sessions for hosted web login.

### 2026-04-27 - Implementation: Cloudflare Deploy Path Shipped

**Context**: The planned deployability work was implemented through `/sdd-implementation`.

**Change**: Added Worker Static Assets config, D1 migrations, cookie sessions, Bearer-compatible auth, deployment scripts, generated Worker types, docs, and verification.

**Impact**: The repo is ready for future Cloudflare deployment after replacing placeholder D1 IDs and setting secrets.

**Decision**: Keep Cloudflare Worker + D1 as the default hosted path; keep Node/Postgres as the local/self-host path.
