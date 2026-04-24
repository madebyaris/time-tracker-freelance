# ttf-002 — Progress

## Status: shipped

All five phases of the [plan](plan.md) are implemented and verified.

## What landed

### Phase 1 — Data foundations

Six new columns on `clients`, end-to-end synced via the existing push/pull engine:

- `logo_data` (base64 WebP, ≤ 64 KB)
- `website`, `phone`, `address`, `tax_id` (text)
- `default_hourly_rate_cents` (integer)

Touched files:

- `packages/db/src/sqlite/schema.ts` — Drizzle SQLite columns
- `packages/db/src/postgres/schema.ts` — Drizzle Postgres columns
- `packages/db/migrations/postgres/0003_clients_extra.sql` (+ `_journal.json`)
- `apps/desktop/src/db/migrations.ts` — desktop migration v4
- `apps/desktop/src/db/repos.ts` — `Client` interface + `Clients.create`/`update`
- `apps/api/src/lib/worker-store.ts` — D1 schema, upgrade steps, sync column whitelist

The sync engine (`apps/desktop/src/sync/engine.ts`) already uses `SELECT *` and the API zod schema is `.passthrough()`, so the new columns flow end-to-end without further wiring.

### Phase 2 — Richer Clients UI

- `packages/ui/src/components/Avatar.tsx` — new shared primitive (image src + hashed-initials fallback, 8-color palette, sizes 16/20/24/32/40/48/64).
- `apps/desktop/src/lib/encode-logo.ts` — DOM-only WebP/PNG encoder (96×96 cover-crop, ≤ 90 000 char data URL guard, `image/*` MIME guard).
- `apps/desktop/src/views/ClientsView.tsx` — two-column edit form with logo dropzone, website, phone, address (textarea), tax ID, default hourly rate (decimal ↔ cents). List rows now use `<Avatar>` and surface website + currency.

### Phase 3 — Claude-style quick panel

- `apps/desktop/src/panel/QuickPanel.tsx` — focused single-card panel with idle ↔ running variants, project chip, primary action, and footer hint about `⌘⇧Space`.
- `apps/desktop/src/panel.tsx` — swapped `<TimerBar compact />` for `<QuickPanel />`; kept the focus / blur / refetch lifecycle.
- `apps/desktop/src-tauri/tauri.conf.json` — panel height bumped to 168 px to accommodate the two-row layout.
- `apps/desktop/src-tauri/src/lib.rs` + `tray.rs` — `⌘⇧Space` global shortcut anchored on the tray icon via `tray.rect()`.

UX details:

- Auto-focus + select on every panel show (when idle).
- `Enter` starts the timer when idle; no-op while running so the user can edit the description without accidentally stopping.
- `Escape` hides the panel.

### Phase 4 — Live menubar timer

- `apps/desktop/src-tauri/src/timer_state.rs` — managed singleton with a 1Hz tokio ticker. Format helper renders `m:ss` for the first hour, then `h:mm`. Two unit tests cover both regimes.
- `apps/desktop/src/state/timer.ts` — `timer://changed` payload extended to a discriminated union `{ kind: 'start'; started_at; description } | { kind: 'stop' }`.
- `apps/desktop/src-tauri/src/tray.rs` — `app.listen_any` deserialises the payload and routes to `TimerState::start/stop`. Initial title set synchronously on start so the first frame is always populated.
- `apps/desktop/src-tauri/Cargo.toml` — added `tokio = { version = "1", features = ["time", "rt"] }`.

Pause semantics in v1 = quick-stop (per plan §4 decision table). No new schema columns, no migration churn. A future `ttf-003` may upgrade to a true `paused_at` if the workflow demands it.

### Phase 5 — Verification

- `pnpm -r typecheck` — clean across all 7 workspace projects.
- `cargo check` — clean.
- `cargo test --lib` — 2 new tests in `timer_state` pass.
- `ReadLints` on every touched file — clean.

## Deviations vs plan

- **Avatar palette source.** Plan suggested "8 zinc/indigo/emerald/amber/rose tints"; implementation uses `zinc · indigo · emerald · amber · rose · sky · violet · teal` so adjacent client names get visibly different colors.
- **Logo encoder fallback.** When WebP isn't supported by the WKWebView build, the helper now silently falls back to PNG instead of erroring.
- **Pause UX wording.** The icon-only top-right button says "Pause"; the secondary action under the project chip says "Stop & save". Both call the same finalise-now path; the dual labels make the consequence clear without two backend modes.

## What's next (deferred)

- Branded invoice PDFs that render `client.logo_data` (track in a future `ttf-003`).
- True paused state on `time_entries` if user feedback shows quick-stop loses context.
- R2/S3 logo store if logos start exceeding 64 KB or row size becomes a hot spot.
