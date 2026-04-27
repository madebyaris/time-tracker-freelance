<p align="center">
  <img src="docs/readme/hero.svg" alt="Tickr hero banner" width="100%" />
</p>

<p align="center">
  <a href="specs/active/ttf-002/feature-brief.md"><img src="https://img.shields.io/badge/status-ttf--002%20shipped-18c37e?style=flat-square" alt="ttf-002 shipped" /></a>
  <a href="specs/active/ttf-004/feature-brief.md"><img src="https://img.shields.io/badge/deploy-Cloudflare%20shipped-18c37e?style=flat-square" alt="Cloudflare deploy shipped" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20first-111827?style=flat-square" alt="macOS first" />
  <img src="https://img.shields.io/badge/offline-local%20first-0f766e?style=flat-square" alt="Local first" />
  <img src="https://img.shields.io/badge/stack-Tauri%202%20%2B%20React%20%2B%20Rust-1d4ed8?style=flat-square" alt="Tauri React Rust" />
</p>

<h1 align="center">Tickr</h1>

<p align="center">
  A local-first time tracker for indie freelancers on macOS.
</p>

Tickr helps freelancers track time, manage clients/projects, prepare invoices, and optionally sync data to a private web dashboard.

You can use it in two ways:

- **Offline desktop app**: best if you only need Tickr on one Mac.
- **Private hosted dashboard**: best if you want browser access and desktop sync.

The easiest hosted setup is **Cloudflare Workers + D1**. VPS support is available as a manual Node/Postgres path, but it is not yet packaged as a one-command production installer.

## What Tickr Does

- Track time with a native macOS app.
- Start timers from a quick panel with global shortcuts.
- Pause and resume without losing accurate billable time.
- Manage clients, projects, tasks, reports, and invoices.
- Add client logos, addresses, tax IDs, websites, phone numbers, and rates.
- Export CSV data.
- Generate branded PDF invoices with your logo, address, tax ID, signature, and payment instructions.
- Sync to a private API and view the same data in a web dashboard.

## Pick Your Setup

### Option 1: Offline Mac App

Choose this if you only want to track time on your Mac.

You do **not** need an account, server, Cloudflare, VPS, or database. Your data stays local on your computer.

### Option 2: Cloudflare Web Dashboard

Choose this if you want:

- A private website for your dashboard.
- Desktop sync.
- No VPS maintenance.
- A simpler future deployment path.

This is the recommended hosted setup.

### Option 3: VPS / Self-Hosted Server

Choose this only if you specifically want to run your own Linux server.

Current VPS support is a manual Node.js API + Postgres setup. It works as a self-host path, but it does not yet include a polished Docker/Nginx/Caddy production bundle.

## Before You Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Rust stable, only if you want to run or build the desktop app from source.
- Docker, only if you want local Postgres or VPS-style self-hosting.
- A Cloudflare account, only if you want the recommended hosted dashboard.

Install project dependencies:

```bash
pnpm install
```

## Use Tickr Offline

Run the desktop app:

```bash
pnpm desktop
```

Build the desktop app:

```bash
pnpm desktop:build
```

Useful shortcuts:

| Shortcut | Action |
|---|---|
| `Cmd+Shift+Space` | Open or close the quick panel |
| `Option+Cmd+T` | Start or stop the timer |
| `Enter` in quick panel | Start tracking |
| `Esc` in quick panel | Close the panel |
| `Cmd+O` in quick panel | Open the full app |
| `Cmd+Q` | Quit |

## Deploy the Web Dashboard on Cloudflare

This is the recommended deployment for non-developers because it avoids managing a VPS.

### What Cloudflare Will Host

- The web dashboard.
- The API routes for login and sync.
- The D1 database that stores hosted sync data.

### 1. Log In to Cloudflare

```bash
pnpm --filter @ttf/api exec wrangler login
```

### 2. Create Databases

```bash
pnpm --filter @ttf/api exec wrangler d1 create tickr-staging
pnpm --filter @ttf/api exec wrangler d1 create tickr-prod
```

Cloudflare will print database IDs. Copy those IDs into `infra/wrangler/wrangler.jsonc`:

- Put the staging ID in `env.staging.d1_databases[0].database_id`.
- Put the production ID in `env.production.d1_databases[0].database_id`.

### 3. Add Login Secrets

Run these commands:

```bash
openssl rand -hex 32 | pnpm --filter @ttf/api exec wrangler secret put JWT_SECRET -c ../../infra/wrangler/wrangler.jsonc --env staging
openssl rand -hex 32 | pnpm --filter @ttf/api exec wrangler secret put JWT_SECRET -c ../../infra/wrangler/wrangler.jsonc --env production
```

### 4. Create the Database Tables

```bash
pnpm cf:migrate:staging
pnpm --filter @ttf/api exec wrangler d1 migrations apply tickr-prod --remote -c ../../infra/wrangler/wrangler.jsonc --env production
```

### 5. Test Before Deploying

```bash
pnpm cf:check
pnpm cf:types:check
pnpm cf:deploy:dry
```

### 6. Deploy

```bash
pnpm cf:deploy:staging
```

For the detailed Cloudflare guide, see [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

## Connect the Desktop App to Your Hosted Dashboard

1. Open the deployed website.
2. Register the first user.
3. Log in.
4. Use the web dashboard normally in your browser.
5. Create a desktop sync token with the command below.
6. Open Tickr desktop settings and paste:
   - Backend URL: your hosted Worker URL.
   - Token: the token from the command below.

Desktop sync still uses a Bearer token. The web dashboard uses a safer browser cookie session.

Replace the email, password, and URL before running this:

```bash
curl -sS \
  -H "content-type: application/json" \
  -X POST "https://your-worker-url.example/auth/login" \
  --data '{"email":"you@example.com","password":"your-password"}'
```

Copy the `token` value from the response into the desktop app settings.

## Run Locally With Sync

This is useful if you want to test the backend and web dashboard before deploying.

Start Postgres:

```bash
pnpm db:up
```

Set local environment variables:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/timetracker
export JWT_SECRET=$(openssl rand -hex 32)
export CORS_ORIGIN=http://localhost:1420,http://localhost:5173
export REGISTRATION_MODE=open
```

Apply database migrations:

```bash
pnpm db:migrate:pg
```

Start the API:

```bash
pnpm api
```

Start the web dashboard in a second terminal:

```bash
pnpm web
```

Open `http://localhost:5173`, register a user, and connect the desktop app to `http://localhost:8787` if you want desktop sync.

## VPS / Self-Hosted Notes

The VPS path is currently for people comfortable running Node.js, Postgres, and a reverse proxy.

Minimum pieces:

- Postgres database.
- Node.js API from `apps/api`.
- Built web dashboard from `apps/web/dist`.
- HTTPS reverse proxy such as Caddy or Nginx.
- Environment variables from `.env.example`.

Required API environment variables:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/timetracker
JWT_SECRET=replace-with-openssl-rand-hex-32
PORT=8787
CORS_ORIGIN=https://your-domain.example
REGISTRATION_MODE=first-user
```

Production VPS checklist:

- Run `pnpm db:migrate:pg` before starting the API.
- Run `pnpm api:build`.
- Start `apps/api/dist/index.node.js` with a process manager.
- Serve `apps/web/dist` from your reverse proxy.
- Proxy `/auth/*`, `/sync/*`, and `/health` to the API.
- Use HTTPS.

This README intentionally treats Cloudflare as the easier hosted path until the VPS setup has its own production Docker/reverse-proxy package.

## Common Commands

| Script | Description |
|---|---|
| `pnpm desktop` | Run the macOS desktop app |
| `pnpm desktop:build` | Build the desktop app |
| `pnpm web` | Run the web dashboard locally |
| `pnpm web:build` | Build the web dashboard |
| `pnpm api` | Run the Node/Postgres API locally |
| `pnpm api:build` | Build the API |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm db:up` | Start local Postgres |
| `pnpm db:migrate:pg` | Apply Postgres migrations |
| `pnpm cf:check` | Validate Cloudflare deploy with a dry run |
| `pnpm cf:migrate:staging` | Apply staging D1 migrations |
| `pnpm cf:deploy:staging` | Deploy to Cloudflare staging |

## Project Layout

```text
apps/
  desktop/      macOS desktop app
  web/          browser dashboard
  api/          hosted API for sync and auth
packages/
  db/           database schemas and migrations
  shared/       shared sync contracts and utilities
  ui/           shared UI components
  invoice-pdf/  PDF invoice template
infra/
  docker/       local Postgres compose file
  wrangler/     Cloudflare Worker deploy config
docs/
  deploy-cloudflare.md
```

## Feature Specs

This repo uses Spec-Driven Development. Completed work is documented in `specs/active`.

- [`ttf-001`](specs/active/ttf-001/feature-brief.md): first desktop/API/web sync foundation.
- [`ttf-002`](specs/active/ttf-002/feature-brief.md): richer clients, quick panel, menubar timer, real pause.
- [`ttf-003`](specs/active/ttf-003/feature-brief.md): invoice PDF export and branded invoice profile.
- [`ttf-004`](specs/active/ttf-004/feature-brief.md): Cloudflare deployability and web auth hardening.

## License

MIT
