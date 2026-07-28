# ttf-008 — macOS WidgetKit widget

**Status:** shipped
**Depends on:** ttf-007 (spike proved ad-hoc + temporary exception works)
**Date:** 2026-07-28

## Goal

Ship a real macOS desktop / Notification Center widget that shows the running
timer and today's totals, without any Apple Developer Program membership.

## Non-goals

- App Groups or a paid / Personal Team certificate
- Typing a new timer description directly inside the widget
- A direct Stop action (Pause/Resume and New Timer cover the quick workflow)
- Widget support below macOS 14
- Windows / Linux widgets

## Architecture

```
timer store (JS) ──write_widget_state──► ~/Library/Application Support/Tickr/widget-state.json
        │                                              ▲
        │ on start/pause/stop                          │ temporary-exception
        ▼                                              │
tickr-widget-refresh ──WidgetCenter.reload──► TickrWidget.appex

widget AppIntent ──tickr:// action──► Rust router ──queued action──► timer store
```

- Host app stays **non-sandboxed** and writes the snapshot.
- Widget is **sandboxed** with
  `com.apple.security.temporary-exception.files.home-relative-path.read-only`
  for `/Library/Application Support/Tickr/`.
- Live ticking uses SwiftUI `Text(timerInterval:)` — no per-second reloads.
- Timeline reloads are reserved for real state transitions; a 60s file refresh
  keeps today's totals current without spending reload budget.
- Widget controls stay interactive without write access: AppIntents open
  `tickr://open`, `tickr://panel`, `tickr://pause`, or `tickr://resume`.

## Layout

| Path | Role |
|---|---|
| `src-tauri/macos-widget/` | xcodegen sidecar: `.appex` + refresh helper |
| `src-tauri/src/widget.rs` | Rust commands: write snapshot, report status |
| `src/lib/widget-bridge.ts` | Assembles snapshot from DB + timer; publishes on change |
| `macos-widget/build-macos.sh` | Correct local release order: app → embed → DMG |
| `.github/workflows/release.yml` | xcodegen, embed after build, verify, draft release |

## Decisions

- **No App Groups.** Spike confirmed the temporary exception works ad-hoc.
- **Read-only data, interactive commands.** The widget never writes shared
  state. AppIntents send custom deep links and Tickr performs actions against
  SQLite, so no App Group or writable sandbox exception is needed.
- **`bundle.targets` stays `"all"`.** macOS CI / `build-macos.sh` pass
  `--bundles app` and rebuild the DMG after embed, so Windows/Linux keep their
  full installer set.
- **Widget build is best-effort in CI.** Missing xcodegen / Xcode failure skips
  the widget rather than failing the release (`--optional` on embed).
- **Dev builds have no widget.** `tauri dev` produces no `.app`, so Settings
  explains that a packaged build is required.

## Manual step after install

Widgets only appear once Tickr is in `/Applications` and has been launched.
Right-click desktop → Edit Widgets → add Tickr.

## Changelog

### 2026-07-28 — Addition: widget action buttons

**Context:** A read-only state file prevents direct database mutation from the
widget, but does not prevent it from opening a custom application URL.

**Change:** Added Open, New Timer, Pause, and Resume controls. New Timer opens
the Quick Panel; timer actions are queued in Rust across cold launch and drained
by the initialized React timer store.

**Impact:** The widget remains compatible with ad-hoc signing and the proven
read-only entitlement. No App Group or Apple Developer enrollment is required.
