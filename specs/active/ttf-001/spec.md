# Tickr — Requirements

## In scope

- **Desktop (primary)**: Tauri 2, React 19, SQLite via `tauri-plugin-sql`, menu bar + main window, left-click tray quick-timer popover, start/stop timer, grouped project/client selection, direct client-only entries (without a project), manual/custom time entry backfill, projects/clients, day view, CSV export, reports (Recharts), PDF invoices, Pomodoro, idle prompt path, global shortcut ⌥⌘T, optional native stubs for auto-track/calendar.
- **Backend (optional)**: Hono, Postgres, JWT auth (email/password), Zod, `/auth/*`, `/sync/push` + `/sync/pull` with last-write-wins, Drizzle schema in `@ttf/db`.
- **Web (optional)**: Vite + React, token + base URL, pull sync summary.
- **Infra**: Docker Compose for Postgres, Wrangler + Worker stub for Cloudflare path.

## Desktop UX notes

- The desktop shell should feel macOS-native: reliable window dragging, compact chrome, keyboard-friendly actions, and tray-first access.
- The main timer input should support selecting either a project or a client so ad-hoc work can be tracked without creating placeholder projects.
- The tray icon should expose quick actions through a lightweight popover instead of only a static menu.
- The day view should support manual backfill when the freelancer forgot to start the timer.
- The desktop layout should remain usable down to the configured minimum window width.

## Out of scope (future)

- Full Accessibility / EventKit / Google Calendar OAuth implementations (stub commands exist).
- Full D1 parity in Worker (stub returns 501 with guidance).
- Full calendar/timeline editing interactions for existing entries (resize/drag inline editing).

## Non-goals

- Mobile apps in v1.
- Multi-tenant SaaS (single-user + multi-device is enough).

## Verification

- `pnpm -r typecheck` passes.
- `cd apps/desktop/src-tauri && cargo check` passes.
- `DATABASE_URL=… pnpm --filter @ttf/db migrate:postgres` applies migrations to Postgres.
- `pnpm --filter @ttf/api dev` serves `/health`, `/auth/register`, `/sync/*`.
- Desktop verification covers:
  - top chrome can drag the window
  - tray left-click opens the quick timer popover
  - timer can start against either a project or a client
  - manual/custom time entry creates backfilled sessions in day view
