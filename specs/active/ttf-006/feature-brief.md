# ttf-006 — Windows and macOS polish

## Summary

Tickr is architecturally cross-platform — CI builds macOS, Windows, and Linux — but the product polish is macOS-first. Windows users get a tray icon that never shows the running timer, idle detection that always reports zero, a quick panel positioned for a Dock that isn't there, and keyboard hints showing the Command symbol. This closes those gaps and adds the macOS niceties that were skipped.

## Status

- **Spec**: shipped — see [todo-list.md](todo-list.md) and [progress.md](progress.md)
- **Implementation**: shipped
- **Depends on**: shipped ttf-001 desktop shell, shipped ttf-002 tray QuickPanel

## Goals

- Show elapsed time on Windows and Linux, where tray icons have no title.
- Make idle detection work on Windows.
- Position the quick panel using the monitor work area instead of a hardcoded Dock offset.
- Use per-OS keyboard shortcut defaults and show the right modifier symbols.
- Tell the user when a global shortcut fails to register instead of only logging it.
- Add launch-at-login.
- macOS: optional Dock-icon hiding and native panel vibrancy.

## Non-goals

- No Windows EV code signing — SmartScreen warnings remain, documented in `docs/install-unsigned.md`.
- No Apple notarization (see ttf-007/ttf-008 for why this is not required).
- No auto-updater.
- No user-remappable shortcuts — per-OS defaults only, remapping is a separate feature.
- No jump lists, Mica/Acrylic, or Windows Store packaging.

## Problems Being Fixed

| Problem | Where | Platform |
|---|---|---|
| `tray.set_title()` called unconditionally; only macOS renders a tray title | `timer_state.rs` | Windows, Linux |
| `idle_seconds()` returns a hardcoded `0`, so the idle watcher and its notifications never fire | `commands.rs` | Windows, Linux |
| Panel anchored with a hardcoded `96.0` offset for the macOS Dock | `tray.rs` | Windows, Linux |
| Panel keyboard hints render the Command symbol regardless of OS | `QuickPanel.tsx` | Windows, Linux |
| Shortcut defaults use the Super key, colliding with OS bindings | `lib.rs` | Windows |
| Shortcut registration failures only reach the log | `lib.rs` | all |
| Dead `tray://start` / `tray://stop` listeners with no emitter | `App.tsx` | all |
| No launch-at-login | — | all |
| App occupies the Dock despite being tray-first | — | macOS |
| Panel blur is CSS-only, not native vibrancy | `QuickPanel.tsx` | macOS |

## Decisions

- **Tray text**: keep `set_title` on macOS; mirror the same string into `set_tooltip` elsewhere so hovering reveals the timer. One `set_tray_label` helper owns the platform split.
- **Idle**: `idle.rs` becomes a single module with cfg-gated implementations — CoreGraphics on macOS, `GetLastInputInfo` on Windows, `0` elsewhere. FFI is declared inline to avoid pulling in `windows-sys`.
- **Shortcuts**: macOS keeps `⌥⌘T` / `⇧⌘Space`. Windows and Linux use `Ctrl+Alt+T` / `Ctrl+Alt+Space`, avoiding reserved Super-key combinations.
- **Positioning**: use the monitor work area when available so the panel clears the taskbar wherever it lives, falling back to a small inset.
- **Dock hiding** is opt-in, because hiding the Dock icon on a tray-first app surprises people who expect to Cmd-Tab to it.

## Changelog

### 2026-07-28 - Addition: Cross-platform polish planned

**Context**: An audit of platform-specific code found only five conditional compilation sites, with several macOS assumptions applied unconditionally to all platforms.

**Change**: Planned `ttf-006` to close the Windows gaps and add deferred macOS polish.

**Impact**: Windows and Linux become genuinely usable rather than nominally supported.

**Decision**: Keep shortcut remapping and installer branding out of scope; fix correctness and per-platform defaults first.
