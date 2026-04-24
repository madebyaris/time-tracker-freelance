# ttf-001 — Implementation todo list

## Phase 1 — Desktop workflow completion

- [x] Add inline edit for existing day-view entries in `apps/desktop/src/views/DayView.tsx`
- [x] Reuse grouped project/client target helpers from `apps/desktop/src/lib/time-entry-target.ts`
- [x] Add client edit flow in `apps/desktop/src/views/ClientsView.tsx`
- [x] Add project edit flow in `apps/desktop/src/views/ProjectsView.tsx`
- [x] Polish reports dark mode / grouping / currency handling in `apps/desktop/src/views/ReportsView.tsx`
- [x] Reconcile tray/startup behavior across `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/src/tray.rs`, and `apps/desktop/src-tauri/tauri.conf.json`

## Phase 2 — Shared API / Worker parity

- [x] Extract API composition into reusable route factory / app builder
- [x] Make auth helpers env-aware for Node and Worker runtimes
- [x] Add D1-backed Worker DB wiring and replace the current Worker stub
- [x] Keep `/health`, `/auth/*`, and `/sync/*` behavior aligned between Node and Worker

## Phase 3 — Web dashboard depth

- [x] Upgrade the web app from summary-only to a richer synced dashboard
- [x] Add useful top-level metrics and a clearer connection/session UX
- [x] Add at least one deeper data view (projects / recent entries / activity chart)

## Phase 4 — Verification

- [x] Run `pnpm --filter @ttf/desktop exec tsc --noEmit`
- [x] Run `pnpm --filter @ttf/api exec tsc --noEmit -p tsconfig.json`
- [x] Run `pnpm --filter @ttf/web exec tsc --noEmit`
- [x] Run `pnpm -r typecheck`
- [x] Run `cd apps/desktop/src-tauri && cargo check`

## Progress log

| Date (UTC) | Status | Note |
|------------|--------|------|
| 2026-04-24 | in_progress | Started broader execution pass from `ttf_next_phase_c722b5f0.plan.md`; scope includes desktop completion plus shared API/Worker and web upgrades. |
| 2026-04-24 | completed | Landed desktop inline editing + CRUD polish, tray-first startup cleanup, shared Node/Worker API composition, D1-backed Worker auth/sync, web dashboard upgrade, and cross-stack `client_id` support for `time_entries`. |
