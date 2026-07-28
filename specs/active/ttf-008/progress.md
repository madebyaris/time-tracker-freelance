# ttf-008 — Progress

## Status: shipped (gallery add is a one-time manual check)

## What changed

| Area | Change |
|---|---|
| Sidecar | `macos-widget/` — WidgetKit `.appex`, refresh helper, entitlements, scripts |
| Rust | `widget.rs` writes atomic JSON + optional timeline reload |
| Deep links | `deep_links.rs` routes `tickr://` actions and queues timer commands across cold launch |
| Frontend | `widget-bridge.ts` publishes on `timer://changed` and every 60s |
| Actions | AppIntents provide Open, New Timer, Pause, and Resume controls |
| Config | `beforeBundleCommand` builds the widget before bundling |
| CI | macOS jobs use `--bundles app`, embed + DMG, verify, separate draft release job |
| Docs | Widget section in `docs/install-unsigned.md` |

## Spike carry-over (ttf-007)

Ad-hoc signed `.appex` registers with PlugInKit. Sandboxed probe with the
widget's entitlements reads `widget-state.json`. App Groups / paid enrollment
not required. See `specs/active/ttf-007/feature-brief.md`.

## Deferred

- Inline task creation inside the widget; New Timer opens the Quick Panel
- Direct Stop button
- Live totals while running without waiting for the next timeline (file is
  already refreshed every 60s; WidgetKit decides when to re-read)

## Verification

- `verify-widget.sh` all green against build dir and `/Applications`
- DMG contains `.appex` with temporary-exception entitlements
- App launch writes a real snapshot from SQLite
- `tickr://open` and `tickr://panel` show the correct installed-app windows
- `tickr://pause` and `tickr://resume` are delivered without crashing while idle
- Installed widget binary contains all four AppIntent types
- Workspace typecheck + 45 desktop unit tests pass
