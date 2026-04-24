# ttf-001 — Task checklist (mirrors product milestones)

- [x] M0 monorepo + `packages/*`
- [x] M0 Drizzle SQLite + Postgres schema + `migrations/postgres/0000_initial.sql`
- [x] M1 Tauri + tray + global shortcut + offline CRUD + CSV
- [x] M2 Idle + notifications + Pomodoro UI
- [x] M3 Recharts + `@react-pdf` invoices
- [x] M4 Hono API + Docker Postgres + JWT auth
- [x] M5 Client sync engine + server `/sync/*`
- [x] M6 Web dashboard (minimal)
- [x] M7 Native command stubs (auto-track / calendar)
- [x] M8 Wrangler + Worker stub + cron placeholder

## Follow-ups (evolve / refine)

- [x] Desktop shell polish: flatter macOS-style layout, shadcn-based primitives, responsive sidebar behavior
- [x] Replace plain timer project select with grouped project/client picker
- [x] Add tray quick-timer popover with start/stop, task, and selection
- [x] Support direct client-only time entries (no project required)
- [x] Add manual/custom time entry flow for backfilling missed sessions
- [x] Fix macOS window dragging in overlay titlebar mode via capability + explicit drag call
- [ ] D1 + shared route factory for true dual deploy
- [ ] `better-auth` or OAuth replace minimal JWT
- [ ] Tauri Updater + signed macOS build
- [ ] Inline edit / resize existing day-view entries
