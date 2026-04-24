<p align="center">
  <img src="docs/readme/hero.svg" alt="Tickr hero banner" width="100%" />
</p>

<p align="center">
  <a href="specs/active/ttf-002/feature-brief.md"><img src="https://img.shields.io/badge/status-ttf--002%20shipped-18c37e?style=flat-square" alt="ttf-002 shipped" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20first-111827?style=flat-square" alt="macOS first" />
  <img src="https://img.shields.io/badge/offline-local%20first-0f766e?style=flat-square" alt="Local first" />
  <img src="https://img.shields.io/badge/stack-Tauri%202%20%2B%20React%20%2B%20Rust-1d4ed8?style=flat-square" alt="Tauri React Rust" />
</p>

<h1 align="center">Tickr</h1>

<p align="center">
  A local-first time tracker for indie freelancers on macOS.
</p>

Built for a personal-first workflow: fast capture, offline by default, optional sync when you want it.

- Desktop app works **fully offline** — no account required.
- Optional self-hostable backend for sync, web dashboard, and recurring invoices.
- Own your data: SQLite file locally, CSV export everywhere.

## At a glance

| Desktop | Sync | Billing |
|---|---|---|
| Spotlight-style quick panel, live menubar timer, native macOS tray flow | Optional self-hosted backend with sync to desktop + web | Reports, invoice lines, recurring invoices, CSV export |

## Highlights

- **Spotlight-style quick panel.** A thin horizontal bar docked at the bottom-center of the screen. Summon from anywhere with `⌘⇧Space`, dismiss with `Esc`. Type what you're working on, pick a project/client, hit `Enter` to start.
- **Live menubar timer.** While a timer runs, the macOS menubar icon ticks every second (`m:ss` then `h:mm`). Pause freezes it as `⏸ 12:34`; stop clears it back to the icon.
- **Real pause, not quick-stop.** Pause keeps the entry open, freezes the elapsed clock, and folds the pause time into a `paused_seconds` accumulator on resume — so the saved duration excludes pause time everywhere it shows up (Day view, Reports, Invoices, CSV export, web dashboard).
- **One source of truth for the timer controls.** The QuickPanel and the in-app TimerBar both render the same `TimerControls` cluster, so Start / Pause / Resume / Stop look and behave identically across windows.
- **Rich client profiles.** Each client carries a logo (96×96 WebP, embedded as base64 so it syncs in-row), website, phone, address, tax ID, and default hourly rate. Logos are auto-resized + cover-cropped client-side; an `Avatar` primitive falls back to hashed initials when no logo is set.
- **Global shortcuts.** `⌘⇧Space` summon panel · `⌥⌘T` toggle timer without focusing any window · `⌘O` swap from the panel to the full app · `⌘Q` quit.

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

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘⇧Space` | Summon / dismiss the quick panel (anywhere) |
| `⌥⌘T` | Start / stop the timer without opening any window |
| `Enter` (panel, idle) | Start the timer |
| `Esc` (panel) | Dismiss the panel |
| `⌘O` (panel) | Swap the panel for the full Tickr window |
| `⌘Q` | Quit Tickr |

## Specs

This repo follows a lightweight Spec-Driven Development flow. Active features live under `specs/active/<id>/` with a `feature-brief.md`, `plan.md`, `progress.md`, and `todo-list.md`.

- [`ttf-001`](specs/active/ttf-001/feature-brief.md) — initial sync engine, tray plumbing, Clients/Tasks views (shipped).
- [`ttf-002`](specs/active/ttf-002/feature-brief.md) — richer client profile, Spotlight-style quick panel, live menubar timer, real pause semantics (shipped).

## License

MIT
