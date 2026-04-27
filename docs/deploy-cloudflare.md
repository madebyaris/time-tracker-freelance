# Deploy Tickr to Cloudflare

This guide covers the dead-simple hosted path planned in `ttf-004`: one Cloudflare Worker serves the Vite web dashboard and the Hono API, backed by D1.

## What Gets Deployed

- `apps/web/dist` as Worker Static Assets.
- `apps/api/src/worker.ts` as the Worker entry.
- `/auth/*`, `/sync/*`, and `/health` through Hono.
- D1 as the hosted sync/auth database.

The Node/Postgres path remains available for local or self-hosted API development.

## Prerequisites

- Node.js 20+
- pnpm 10+
- A Cloudflare account
- Wrangler login:

```bash
pnpm --filter @ttf/api exec wrangler login
```

## One-Time Cloudflare Setup

Create D1 databases:

```bash
pnpm --filter @ttf/api exec wrangler d1 create tickr-staging
pnpm --filter @ttf/api exec wrangler d1 create tickr-prod
```

Copy the returned database IDs into `infra/wrangler/wrangler.jsonc`:

- `env.staging.d1_databases[0].database_id`
- `env.production.d1_databases[0].database_id`

Set secrets:

```bash
openssl rand -hex 32 | pnpm --filter @ttf/api exec wrangler secret put JWT_SECRET -c ../../infra/wrangler/wrangler.jsonc --env staging
openssl rand -hex 32 | pnpm --filter @ttf/api exec wrangler secret put JWT_SECRET -c ../../infra/wrangler/wrangler.jsonc --env production
```

Apply D1 migrations:

```bash
pnpm cf:migrate:staging
pnpm --filter @ttf/api exec wrangler d1 migrations apply tickr-prod --remote -c ../../infra/wrangler/wrangler.jsonc --env production
```

## Local Cloudflare Dev

Create `.dev.vars` from `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
```

Use a real random secret:

```bash
JWT_SECRET=$(openssl rand -hex 32)
```

Apply local D1 migrations:

```bash
pnpm cf:migrate:local
```

Run the Worker + web assets locally:

```bash
pnpm cf:dev
```

## Preflight Checklist

Run these before deployment:

```bash
pnpm typecheck
pnpm web:build
pnpm api:build
pnpm cf:check
pnpm cf:types:check
pnpm cf:deploy:dry
```

## Deploy Staging

```bash
pnpm cf:deploy:staging
```

Tail logs:

```bash
pnpm cf:tail:staging
```

## Web Login Model

The hosted web dashboard uses `HttpOnly` cookie sessions:

- Browser login/register sets `tickr_session`.
- `/auth/me` accepts the cookie.
- `/auth/logout` clears the cookie and deletes the session row.

Desktop sync still uses Bearer tokens returned by `/auth/login` or `/auth/register`.

## Registration Modes

Set `REGISTRATION_MODE` in Wrangler vars:

- `open`: anyone can register.
- `first-user`: only the first account can register.
- `disabled`: registration endpoint is closed.

The default Worker mode is `first-user`, which is safest for personal deployments.

## Security Notes

- Do not commit `.dev.vars`.
- Do not put `JWT_SECRET` in Wrangler `vars`; use Wrangler secrets.
- Keep production `CORS_ORIGIN` scoped to your hosted domain and explicit local/Tauri origins.
- D1 schema changes should go through `packages/db/migrations/d1`.
- Hosted web assets and API responses include baseline security headers.

## Manual E2E

After deploying:

- Open the hosted URL.
- Register the first user.
- Confirm `/auth/me` works after refresh.
- Confirm logout clears the web session.
- Configure desktop Settings with the Worker URL and Bearer token.
- Run a desktop sync push/pull.
