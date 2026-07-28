# ttf-006 — Progress

## Status: shipped

## What Changed

| Area | File | Change |
|---|---|---|
| Tray timer | `src-tauri/src/timer_state.rs` | `set_tray_label` replaces `set_tray_title`; title on macOS, tooltip elsewhere. |
| Idle | `src-tauri/src/idle.rs` | Rewritten as cfg-gated implementations: CoreGraphics, `GetLastInputInfo`, and a 0 fallback. |
| Idle | `src-tauri/src/commands.rs` | `idle_seconds` no longer platform-gated; added `set_dock_icon_visible`. |
| Shortcuts | `src-tauri/src/shortcuts.rs` | New. Per-OS defaults, display labels, registration failures, `shortcut_info` command. |
| Panel | `src-tauri/src/tray.rs` | Work-area positioning; anchored under the tray icon on macOS. |
| Wiring | `src-tauri/src/lib.rs` | Autostart plugin, `ShortcutStatus` state, panel vibrancy, shortcut registration. |
| Deps | `src-tauri/Cargo.toml` | `tauri-plugin-autostart`; `window-vibrancy` for macOS; Tauri 2.10.3 → 2.11.5. |
| Permissions | `src-tauri/capabilities/default.json` | Autostart permissions. |
| Frontend | `src/lib/platform.ts` | New. Platform detection, autostart, Dock visibility, shortcut info. |
| Frontend | `src/App.tsx` | Dead `tray://` listeners removed; platform preferences applied at boot. |
| Frontend | `src/panel/QuickPanel.tsx` | Per-OS open accelerator. |
| Frontend | `src/lib/idle.ts` | Honour `idle_detection_enabled` setting; default on. |
| Frontend | `src/views/SettingsView.tsx` | System group: launch at login, hide Dock icon, shortcut status. Idle detection on/off toggle (write-through). |

## Notable Decisions

- **Tauri bumped 2.10.3 → 2.11.5.** `Monitor::work_area()` does not exist in 2.10, and it is the only way to know where the taskbar or Dock actually is. The existing `tauri = "2.1"` requirement already permitted the newer version, so this was a lockfile update rather than a dependency policy change.
- **Windows FFI is declared inline** rather than adding `windows-sys` for two symbols. `GetLastInputInfo` and `GetTickCount` are stable and tiny.
- **Tick rollover is handled with `wrapping_sub`.** `GetTickCount` wraps every ~49.7 days; a naive subtraction would report a ~49-day idle time right after the wrap and trigger a spurious idle prompt.
- **macOS anchors the panel to the tray icon; other platforms centre it.** The menu bar is always at the top of the screen, so the icon's x is a meaningful anchor. A Windows taskbar can be on any edge, so anchoring there would place the panel unpredictably.
- **Shortcut labels come from Rust**, so the UI cannot show a modifier that disagrees with what was registered.
- **Launch-at-login and Dock hiding write through immediately** instead of waiting for Save, because they change OS state and a pending toggle would misrepresent reality.
- **Dock hiding is opt-in.** It also removes the app from Cmd-Tab, and the icon still flashes at launch since the preference lives in SQLite and is read after the window exists.

## Deferred

- Windows EV code signing — SmartScreen warnings remain; `docs/install-unsigned.md` covers the workaround.
- Auto-updater.
- User-remappable shortcuts. The infrastructure (labels + failure reporting) is in place if this is picked up.
- Mica/Acrylic on Windows.

## Verification

- `cargo check` — clean, zero warnings
- `pnpm typecheck` — passes
- `pnpm --filter @ttf/desktop build` — builds clean
- `pnpm --filter @ttf/desktop test` — 45 tests pass

**Not verified:** the Windows tooltip, `GetLastInputInfo`, and taskbar-aware positioning are compile-checked only. They need a Windows machine to confirm behaviour.
