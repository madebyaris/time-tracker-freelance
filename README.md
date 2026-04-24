# Time Tracker for Freelancers

A local-first, lightweight time tracker for indie freelancers, built primarily for macOS.

- Desktop app works **fully offline** — no account required.
- Optional self-hostable backend for sync, web dashboard, and recurring invoices.
- Own your data: SQLite file locally, CSV export everywhere.

## Repo layout

```
apps/
  desktop/         Tauri 2 app (Rust + React) — primary surface
  web/             React dashboard (Vite)
  api/             Hono backend (Node/Bun + Postgres or Cloudflare Workers + D1)
packages/
  db/              Drizzle schemas — SQLite (local) + Postgres + D1 dialects
  shared/          Types, sync protocol, business logic, money/time utils
  ui/              Shared shadcn/ui components
  invoice-pdf/     PDF invoice templates (@react-pdf/renderer)
infra/
  docker/          docker-compose.yml — Postgres + API for self-hosting
  wrangler/        Cloudflare Workers + D1 deploy config
```

## Quickstart

### Prerequisites
- Node.js 20+
- pnpm 10+
- Rust (stable) — for the Tauri desktop app
- Optional: Docker — for self-hosting the backend

### Install
```bash
pnpm install
```

### Run the desktop app (offline mode)
```bash
pnpm desktop          # launches Tauri (native window + Rust shell)
pnpm desktop:web      # web view only, no native shell (faster iteration)
pnpm desktop:build    # produce a release .app bundle
```

### Run the backend + web dashboard (optional)
```bash
pnpm db:up                                                              # Postgres in Docker
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/timetracker
export JWT_SECRET=$(openssl rand -hex 32)
pnpm db:migrate:pg                                                      # apply schema
pnpm api                                                                # http://localhost:8787
pnpm web                                                                # http://localhost:5173
```

Register a user: `POST http://localhost:8787/auth/register` with JSON `{ "email", "password", "name" }` — use the returned `token` in the desktop app ➜ Settings (Backend URL: `http://localhost:8787`).

### Useful root scripts
| Script | Description |
|---|---|
| `pnpm dev` | Run all apps in parallel via Turborepo |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Manage local Postgres container |
| `pnpm db:studio:pg` | Drizzle Studio against Postgres |
| `pnpm cf:deploy` | Deploy the Worker (after setting D1 `database_id` in [infra/wrangler/wrangler.jsonc](infra/wrangler/wrangler.jsonc)) |

For Cloudflare Workers (D1) there is a stub Worker today; full D1 + sync parity is a follow-up tracked in [specs/active/ttf-001/tasks.md](specs/active/ttf-001/tasks.md).

## License

MIT
