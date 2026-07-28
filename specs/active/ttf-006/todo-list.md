# ttf-006 — Todo List

## T1 Tray timer on Windows and Linux

- [x] T1.1 Replace `set_tray_title` with `set_tray_label`, owning the platform split in one place.
- [x] T1.2 Keep `set_title` on macOS.
- [x] T1.3 Mirror the elapsed string into `set_tooltip` on Windows and Linux.
- [x] T1.4 Include the paused `⏸` prefix and the idle reset in the tooltip path.

## T2 Idle detection on Windows

- [x] T2.1 Restructure `idle.rs` into cfg-gated `imp` modules behind one public function.
- [x] T2.2 Keep the CoreGraphics implementation for macOS.
- [x] T2.3 Add a `GetLastInputInfo` implementation with inline FFI, no new crate.
- [x] T2.4 Use `wrapping_sub` so the ~49.7-day tick rollover doesn't report a bogus idle time.
- [x] T2.5 Return 0 on other platforms and drop the cfg from `commands.rs`.
- [x] T2.6 Register `idle` unconditionally in `lib.rs`.

## T3 Panel positioning

- [x] T3.1 Delete the hardcoded `96.0` Dock offset.
- [x] T3.2 Resolve the monitor work area via `Monitor::work_area()` (needed a Tauri bump to 2.11).
- [x] T3.3 Test monitor containment against full bounds, since the tray icon sits inside system chrome.
- [x] T3.4 Anchor under the tray icon on macOS, clamped to the work area.
- [x] T3.5 Centre in the bottom of the work area elsewhere, where the taskbar can be on any edge.

## T4 Shortcuts

- [x] T4.1 Add `shortcuts.rs` owning the per-OS definitions and their display labels.
- [x] T4.2 macOS keeps `⌥⌘T` / `⇧⌘Space`; Windows and Linux use `Ctrl+Alt+T` / `Ctrl+Alt+Space`.
- [x] T4.3 Collect registration failures in a `ShortcutStatus` managed state.
- [x] T4.4 Expose `shortcut_info` so the UI reads labels and issues from the source of truth.
- [x] T4.5 Show the registered accelerators and any failures in Settings.
- [x] T4.6 Render the QuickPanel's open hint as `Ctrl+O` off macOS.

## T5 Both platforms

- [x] T5.1 Remove the dead `tray://start` / `tray://stop` listeners in `App.tsx`.
- [x] T5.2 Add `tauri-plugin-autostart` plus its capability permissions.
- [x] T5.3 Add a launch-at-login toggle that writes through immediately.

## T6 macOS polish

- [x] T6.1 Add a `set_dock_icon_visible` command using `AppHandle::set_dock_visibility`.
- [x] T6.2 Persist the choice and re-apply it at startup.
- [x] T6.3 Apply `window-vibrancy` HudWindow material to the panel.

## T7 Verification

- [x] T7.1 `cargo check` — clean, zero warnings
- [x] T7.2 `pnpm typecheck`
- [x] T7.3 `pnpm --filter @ttf/desktop build`
- [x] T7.4 `pnpm --filter @ttf/desktop test`
- [ ] T7.5 Manual Windows verification — needs a Windows machine; CI only proves it compiles
