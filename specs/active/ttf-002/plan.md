# Technical Plan: Richer clients + Claude-style tray timer

**Task ID:** ttf-002
**Status:** Ready for Implementation
**Based on:** [feature-brief.md](feature-brief.md)
**Depends on:** ttf-001 (sync engine, tray plumbing, Clients/Tasks views, shared `@ttf/ui` primitives)

---

## 1. System Architecture

Three tracks, planned together because they share three concerns: the **sync schema** (Track A adds columns; Track B/C surface them in the tray panel), the **tray surface** (Track B/C both touch the tray), and the **timer event bus** (`timer://changed`, which Track C subscribes to from Rust).

```
                          ┌──────────────────────────────────┐
                          │           desktop (JS)           │
                          │                                  │
   ClientsView ─────►     │  Clients repo  ──┐               │
                          │                  │               │
   QuickPanel  ─────►     │  Timer store ────┼─► sqlite (D)  │
   (tray panel)           │                  │               │
                          │  emits "timer://changed"         │
                          └──────────┬───────────────────────┘
                                     │ tauri event
                                     ▼
                       ┌──────────────────────────────────┐
                       │          desktop (Rust)          │
                       │                                  │
                       │   timer_state.rs ── 1Hz ticker ──┼─► tray.set_title("0:23")
                       │                                  │
                       └──────────────────────────────────┘

                                     │ sync push
                                     ▼
                       ┌──────────────────────────────────┐
                       │  Hono API (Node store / D1 store)│
                       │                                  │
                       │  Postgres / D1  (logo_data + …)  │
                       └──────────────────────────────────┘
```

### Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where do client logos live | base64 in `clients.logo_data` (≤ 64 KB) | Syncs end-to-end with one column, no infra; logos that small comfortably fit any Postgres/D1 row |
| Logo source format | WebP, 96×96, encoded client-side via `<canvas>` | Keeps the row tiny; one format means one render path |
| Pause semantics | Pause = quick-stop; "Resume" starts a fresh entry pre-filled | Avoids a 4-store schema migration (`paused_at` + `paused_seconds`); matches Toggl/Harvest mental model. Upgradeable later. |
| Source of truth for the live tray title | Rust ticker, started/stopped by listening to JS `timer://changed` events | One timer thread; survives JS HMR; doesn't waste a JS interval when window is hidden |
| Where the new "what are you working on" panel lives | Existing `panel` window — replace `TimerBar compact` content with a new `QuickPanel` component | Reuses the popover sizing, transparency, click-outside behavior we already wired in ttf-001 |
| Summon shortcut | New `⌘⇧Space` to open the panel; keep `⌘⌥T` as the toggle-timer shortcut | Two distinct affordances: one to *think*, one to *toggle* |

---

## 2. Technology Stack

No new top-level dependencies. We exercise more of what's already there:

| Layer | Technology | Notes |
|---|---|---|
| Desktop UI | React 19 + Tailwind v4 + `@ttf/ui` | New `Avatar` primitive in `@ttf/ui`; `QuickPanel` lives in `apps/desktop/src/panel/` |
| Image processing | Browser-native `<canvas>` + `toBlob('image/webp', 0.85)` | No new deps; resize done in JS before write |
| Tauri runtime | Tauri 2 (existing) | New listener in `tray.rs`; new `timer_state.rs` module |
| Async ticker | `tokio::time::interval` (already pulled by Tauri) | One task, abortable via `JoinHandle` |
| DB (local) | `tauri-plugin-sql` + Drizzle SQLite (existing) | Schema bumped to v4 |
| DB (server) | Drizzle Postgres + raw D1 (existing) | New PG migration `0003_clients_extra.sql`; new D1 `upgradeSteps` entry |
| Sync | Existing `@ttf/shared` sync protocol | Just expand the `clients` column list in `node-store.ts` and `worker-store.ts` |

No new `package.json` entries are expected. If `<canvas>.toBlob('image/webp')` proves flaky on macOS WKWebView (it should not be), we fall back to PNG at the same size.

---

## 3. Component Design

### 3.1 `@ttf/ui` — `Avatar`

- **Purpose:** Unified initials chip + image avatar so `ClientsView`, `QuickPanel`, day-view rows, and invoices render the same way.
- **Props:** `{ src?: string; name: string; size?: 16|20|24|32|48|64; rounded?: 'md'|'full' }`
- **Behavior:** if `src` (a `data:image/webp;base64,…` URL) present, render `<img>`; else render the existing initials chip with stable color hash from `name`.

### 3.2 `apps/desktop/src/views/ClientsView.tsx`

- Form grows a two-column layout: **left** = logo dropzone + preview; **right** = name, email, website, phone, address (textarea), tax ID, default hourly rate (cents → display), default currency (existing).
- Logo dropzone:
  - File picker or drag-drop (no Tauri-native dialog needed; `<input type="file" accept="image/*">` works in WKWebView).
  - Loads file → `<img>` → draws to off-screen `<canvas>` at 96×96 (cover, centered crop) → `canvas.toBlob('image/webp', 0.85)` → `FileReader.readAsDataURL` → store the resulting `data:image/webp;base64,…` string.
  - Reject if the resulting base64 string > 64 KB (configurable in `lib/limits.ts`).
  - "Remove logo" button clears `logo_data`.
- List rows now lead with the `Avatar` (size 24).

### 3.3 `apps/desktop/src/panel/QuickPanel.tsx` (new)

Single-card focused-input panel that replaces `TimerBar compact` as the panel window's only content.

**Idle layout (~360 × 120):**

```
┌──────────────────────────────────────────────────────┐
│ 🟢  What are you working on? …………………………  [▶ Start]  │
│     ◉ Acme · Marketing site                          │
│ ───────────────────────────────────────────────────── │
│  0h 23m today  ·  3 entries     ⌘⇧Space to focus     │
└──────────────────────────────────────────────────────┘
```

**Running layout (~360 × 140):**

```
┌──────────────────────────────────────────────────────┐
│ ⏸  Writing the spec PR                  00:23:14 [⏸] │
│    ◉ Acme · Marketing site         [⏹ Stop & save]   │
│ ───────────────────────────────────────────────────── │
│  0h 23m today  ·  ⌘⇧Space to pause/resume            │
└──────────────────────────────────────────────────────┘
```

- **State:** subscribes to existing `useTimer()` Zustand store + `timer://changed` cross-window event.
- **Project chip:** opens an inline `Combobox` (existing) anchored under the chip.
- **Primary action:**
  - Idle → "Start" (Cmd-Enter) starts a timer with `{ description, project_id, client_id }`.
  - Running → "Stop & save" finalizes the entry; "⏸" pauses (= quick-stop, see §4).
- **Footer:** today's total + entry count, refreshed when `timer://changed` fires. Hint text rotates contextually.
- **Focus:** input auto-focuses on panel show; Escape collapses the panel; click-outside is already handled by Tauri's `focus: false` panel.

### 3.4 `apps/desktop/src/panel.tsx`

- Today renders `<TimerBar variant="compact" />`. Becomes `<QuickPanel />`.
- Adds a `useEffect` to call `getCurrentWindow().setFocus()` when the panel mounts (so input gets keyboard immediately).

### 3.5 `apps/desktop/src-tauri/src/timer_state.rs` (new)

```rust
pub struct TimerState {
    handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl TimerState {
    pub fn start(&self, app: AppHandle, started_at_ms: i64) { /* spawn 1Hz tick, set_title */ }
    pub fn stop(&self, app: AppHandle) { /* abort handle, clear tray title */ }
}
```

- One singleton stored in Tauri `app.manage()`.
- Format: `< 1h → m:ss` (`23:04`), `≥ 1h → h:mm` (`1:23`). Decision Q3 below.

### 3.6 `apps/desktop/src-tauri/src/tray.rs`

- On app setup, register `app.listen_any("timer://changed", …)`. Handler reads `{ kind: 'start'|'stop'|'pause', started_at }` from the payload and routes to `TimerState`.
- `set_title(None)` clears menubar text on stop/pause.

### 3.7 `apps/desktop/src/state/timer.ts`

- Extend the `timer://changed` payload (currently a bare ping) to include `{ kind, started_at, description?, project_id?, client_id? }`.
- All existing JS subscribers handle the richer payload defensively (ignore unknown fields), so this is forward-compatible.

---

## 4. Data Model

### 4.1 SQLite (`packages/db/src/sqlite/schema.ts`) — `clients` additions

```ts
export const clients = sqliteTable('clients', {
  // ...existing columns...
  logo_data: text('logo_data'),                   // data:image/webp;base64,…
  website: text('website'),
  phone: text('phone'),
  address: text('address'),
  tax_id: text('tax_id'),
  default_hourly_rate_cents: integer('default_hourly_rate_cents'),
});
```

Bump local schema version to v4 in `apps/desktop/src/db/migrations.ts`; migration adds the six columns with `ALTER TABLE clients ADD COLUMN …`.

### 4.2 Postgres (`packages/db/src/postgres/schema.ts`) — same six columns

New migration `packages/db/migrations/postgres/0003_clients_extra.sql`:

```sql
ALTER TABLE clients ADD COLUMN logo_data text;
ALTER TABLE clients ADD COLUMN website text;
ALTER TABLE clients ADD COLUMN phone text;
ALTER TABLE clients ADD COLUMN address text;
ALTER TABLE clients ADD COLUMN tax_id text;
ALTER TABLE clients ADD COLUMN default_hourly_rate_cents integer;
```

Update `packages/db/migrations/postgres/meta/_journal.json` accordingly.

### 4.3 D1 (`apps/api/src/lib/worker-store.ts`)

Add a new entry to `upgradeSteps` mirroring the Postgres migration, plus add the columns to the `clients` `SELECT` and `INSERT` lists used by the sync push/pull handlers.

### 4.4 No `time_entries` change in this spec

Pause = quick-stop ⇒ no new columns. (See §9 "Open Questions" Q1 for the upgrade path if we change our minds later.)

---

## 5. API Contracts

No new endpoints. The existing sync protocol carries the new client columns automatically once they're listed in the per-table column whitelists in `node-store.ts` and `worker-store.ts`.

| Method | Path | Change |
|---|---|---|
| POST | `/sync/push` | Accepts the six new client fields in the `clients` upsert payload |
| GET | `/sync/pull` | Returns the six new client fields in `clients` rows |

**Payload shape (clients row, additions only):**

```jsonc
{
  "logo_data": "data:image/webp;base64,UklGRh4AAABXR…",  // ≤ 64 KB
  "website": "https://acme.example",
  "phone": "+1 555 123 4567",
  "address": "123 Market St\nSan Francisco, CA",
  "tax_id": "EU123456789",
  "default_hourly_rate_cents": 12500
}
```

**Validation (Hono + zod):** `logo_data` must match `/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/` and be ≤ 90,000 chars (≈ 64 KB binary after base64 overhead). `website`, `phone`, `address`, `tax_id` capped at sensible lengths (255, 32, 1024, 64). `default_hourly_rate_cents` is a non-negative integer.

---

## 6. Security Considerations

- **Logo upload:** all decoding happens client-side in WKWebView; we never `eval` or run uploaded content. The `data:` URL is rendered via `<img src=…>`, which is a content-type-bound sink (no script execution).
- **Server validation:** the regex above prevents an attacker pushing a `data:text/html` payload through the sync channel.
- **Size limit:** enforced both at write time (desktop) and at the API boundary (Hono). Prevents DoS via giant base64 strings.
- **PII broadening:** address / phone / tax_id are PII. They live behind the same JWT-gated `/sync/*` endpoints as the rest of the user's data. No new exposure surface.
- **Tray title leakage:** the menubar shows only the *duration*, never the description, so other people seeing your screen don't see what you're working on. (Decision Q3.)

**Security checklist:**
- [ ] Reject non-WebP `data:` URLs at API and desktop write paths
- [ ] Reject logo payloads > 90,000 base64 chars
- [ ] Confirm `<img>` rendering does not execute embedded SVG scripts (we forbid SVG entirely by accepting only WebP)
- [ ] Sync endpoints continue to require JWT

---

## 7. Performance Strategy

- **Logo size budget:** 64 KB cap × ~50 clients (typical freelancer ceiling) = ~3 MB total — trivial for SQLite, comfortably under D1's row-size limits, and harmless for sync payloads.
- **Avatar render:** browsers cache `data:` URLs by content; using the same `Avatar` primitive everywhere means React reuses image elements across views.
- **Tray ticker:** one Rust tokio task tick at 1 Hz; the cost is one syscall + one string format per second while a timer is running. Aborts cleanly on stop.
- **Panel mount:** `QuickPanel` does one `Clients.list` + one `Projects.list` on mount, both already cached by TanStack Query in the main window via shared local SQLite — first paint is instant on warm cache, ≤ 50ms cold.
- **`timer://changed` payload:** ~80 bytes JSON, fired only on user action. No throttling needed.

---

## 8. Implementation Phases

Phase 1 (data foundations) is a hard dependency for everything else; Phases 2–4 can run in parallel after that.

- [ ] **Phase 1 — Data foundations**
  - [ ] Add the six columns to SQLite, Postgres, and D1 schemas
  - [ ] Write Postgres migration `0003_clients_extra.sql` and update `_journal.json`
  - [ ] Add the D1 `upgradeSteps` entry
  - [ ] Bump desktop migration to v4
  - [ ] Extend `Clients` repo (`apps/desktop/src/db/repos.ts`) with the new fields
  - [ ] Expand the column whitelists in `node-store.ts` and `worker-store.ts` so the sync protocol carries them
  - [ ] `pnpm -r typecheck` clean

- [ ] **Phase 2 — Richer Clients UI**
  - [ ] Add `Avatar` primitive in `@ttf/ui`
  - [ ] Replace existing initials chips in Clients/day-view/timer chip with `Avatar`
  - [ ] Build the logo dropzone + WebP encoder (`apps/desktop/src/lib/encode-logo.ts`)
  - [ ] Two-column edit form for clients with the new fields
  - [ ] Wire `default_hourly_rate_cents` to default *new* projects (existing projects untouched — see Q2)

- [ ] **Phase 3 — Claude-style tray panel**
  - [ ] Build `QuickPanel` (idle + running variants)
  - [ ] Replace panel window content from `TimerBar compact` to `QuickPanel`
  - [ ] Register `⌘⇧Space` global shortcut → open panel + focus input
  - [ ] Auto-focus input on panel mount; Escape closes
  - [ ] Cmd-Enter to start; Space to toggle pause when running

- [ ] **Phase 4 — Live menubar timer**
  - [ ] New `apps/desktop/src-tauri/src/timer_state.rs`
  - [ ] Listen to `timer://changed` in `tray.rs`; route to `TimerState`
  - [ ] Extend `timer://changed` payload with `{ kind, started_at }` from JS
  - [ ] Format helper (m:ss / h:mm)
  - [ ] Clear title on stop/pause

- [ ] **Phase 5 — Verify + spec sync**
  - [ ] `pnpm -r typecheck`, `cargo check` on desktop crate
  - [ ] Manual walk-through script (idle → start → menubar ticks → pause → resume → stop)
  - [ ] Update `progress.md`; tick boxes in `tasks.md`

---

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| WKWebView lacks `canvas.toBlob('image/webp', …)` quality flag | Medium — logos balloon past 64 KB | Low | Fall back to PNG at quality 0.8 + smaller 64×64 canvas; same code path |
| Rust ticker keeps running after a JS HMR / window reload | Medium — duplicate tickers, wrong title | Medium | Always `abort()` the previous `JoinHandle` before spawning a new one; idempotent `start` |
| Sync rows grow large enough to blow Postgres `text` index limits | Low — `text` is unbounded | Low | We're not indexing `logo_data`; cap enforces the practical limit |
| User pastes a base64 PNG larger than 64 KB and is confused by the rejection | Low — UX friction | Medium | Clear inline error message + auto-resize attempt before rejecting |
| `⌘⇧Space` collides with macOS Spotlight on some setups (Spotlight is `⌘Space`) or third-party tools | Medium — shortcut "doesn't work" | Medium | Make the shortcut user-configurable in Settings (carry over the existing Settings keybind row) |
| D1 migration runs partially and leaves columns half-added | High — data corruption | Low | `upgradeSteps` is already idempotent (`ADD COLUMN IF NOT EXISTS`-style guards); add a guard for each column |
| Tray title flickers on first second after start | Low — visual noise | Medium | Set the initial title synchronously (`0:00`) before spawning the ticker |

---

## 10. Open Questions

These are decisions I'm pre-answering with a default; flag in review if you want to override:

**Q1 — Logo cap: 32 KB or 64 KB?**
*Default: 64 KB.* Gives room for tasteful gradients; ~50 clients × 64 KB = 3 MB total local DB footprint, still trivial. If we ever ship cloud sync metering, revisit.

**Q2 — Should `default_hourly_rate_cents` retroactively update existing projects?**
*Default: no — applies only to projects created after the value is set.* Avoids surprising cost rewrites on historical data. UI shows a "use this rate" link on existing project rows so the user can opt-in per project.

**Q3 — Tray title format: `0:23` vs `00:23:14` vs `▶ 0:23`?**
*Default: `m:ss` for the first hour, then `h:mm` (`0:23`, then `1:23`).* No leading icon — a permanent ▶/⏸ next to a duration is visually noisy. We rely on the *presence* of a title to mean "running" and absence to mean "stopped". Add a Settings toggle `Show timer in menu bar` (default on) so users who hate it can disable.

---

## Next Steps

- Review this plan; resolve Q1–Q3 if any of the defaults bother you.
- Run `/tasks ttf-002` to expand Phases 1–5 into trackable checkboxes in `tasks.md`.
- Then `/implement ttf-002` to start building (Phase 1 first; Phases 2–4 can fan out to subagents).
