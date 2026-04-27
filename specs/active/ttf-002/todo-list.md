# ttf-002 — Todo list

## Phase 1 — Data foundations (sequential, blocking)

- [x] T1.1 Add 6 columns to SQLite + Postgres + D1 schemas (`logo_data`, `website`, `phone`, `address`, `tax_id`, `default_hourly_rate_cents`)
- [x] T1.2 PG migration `0003_clients_extra.sql` + `_journal.json`
- [x] T1.3 D1 `upgradeSteps` entries + extend `syncTableColumns.clients`
- [x] T1.4 Desktop migration v4 (`apps/desktop/src/db/migrations.ts`)
- [x] T1.5 Extend `Clients` repo (interface + `create`/`update` accept new fields)
- [x] T1.6 `pnpm -r typecheck` clean

## Phase 2 — Richer Clients UI

- [x] T2.1 Add `Avatar` primitive to `@ttf/ui`
- [x] T2.2 `apps/desktop/src/lib/encode-logo.ts` (resize + WebP encode + 64 KB cap)
- [x] T2.3 ClientsView grows two-column form with logo dropzone + new fields
- [x] T2.4 Replace initials chip in client list rows with `Avatar`

## Phase 3 — Claude-style quick panel

- [x] T3.1 New `apps/desktop/src/panel/QuickPanel.tsx` (idle + running variants)
- [x] T3.2 Replace `<TimerBar compact />` with `<QuickPanel />` in `panel.tsx`
- [x] T3.3 Auto-focus input on mount, Escape to close, Enter to start (no-op while running)
- [x] T3.4 Register `⌘⇧Space` global shortcut → opens the panel anchored on tray icon

## Phase 4 — Live menubar timer

- [x] T4.1 Extend `timer://changed` payload in `state/timer.ts` with discriminated `{ kind, started_at, description }` union
- [x] T4.2 New `apps/desktop/src-tauri/src/timer_state.rs` (1Hz tokio ticker, abortable, `m:ss` / `h:mm` format helper, unit-tested)
- [x] T4.3 `tray.rs` listens to `timer://changed`, routes to `TimerState`, registered as managed singleton in `lib.rs`
- [x] T4.4 Cargo dependency on `tokio` (`time` + `rt` features)

## Phase 5 — Verify + spec sync

- [x] T5.1 `pnpm -r typecheck`, `cargo check`, `cargo test --lib`
- [x] T5.2 Update `progress.md`, tick boxes in this file
- [x] T5.3 `feature-brief.md` status flipped to "shipped"
- [x] T5.4 Document QuickPanel project dropdown reachability fix and stable-height decision

## Progress log

| When | What |
|---|---|
| start | Created todo-list, beginning Phase 1 |
| Phase 1 done | Schemas, migrations, repos, sync columns — typecheck clean |
| Phase 2 done | Avatar + encode-logo + rich Clients form (subagent) — typecheck clean |
| Phase 3+4 done | QuickPanel + global shortcut + Rust ticker + listener — typecheck + cargo check + 2 unit tests pass |
| Phase 5 done | progress.md written, brief flipped to shipped |
| 2026-04-27 | QuickPanel project dropdown clipping fixed with stable transparent panel height; dynamic resize glitch avoided |
