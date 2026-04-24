use tauri::Listener;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, Runtime,
};

use crate::timer_state::TimerState;

#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum TimerChangedPayload {
    Start { started_at: i64 },
    Pause { elapsed_seconds: i64 },
    Resume { started_at: i64 },
    Stop,
}

/**
 * Builds the menu bar tray icon.
 *
 *  - Left click  → toggles the QuickPanel popover directly under the
 *                  tray icon (Claude / Raycast style).
 *  - Right click → tiny context menu with just "Open Tickr" and "Quit".
 *
 * Everything timer-related lives in the panel itself, so we avoid the
 * old Show/Hide/Start/Stop submenu that hijacked left clicks on macOS
 * when the user clicked-and-held.
 */
pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Tickr", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tickr", true, Some("Cmd+Q"))?;

    let menu = Menu::with_items(app, &[&open, &separator, &quit])?;

    let tray = app.tray_by_id("main").ok_or_else(|| {
        tauri::Error::AssetNotFound("tray icon 'main' missing from tauri.conf.json".into())
    })?;

    // Right-click → minimal menu. Left click is owned by the panel.
    // (`menuOnLeftClick: false` is set in tauri.conf.json.)
    tray.set_menu(Some(menu))?;
    tray.on_menu_event(|app, event| match event.id().0.as_str() {
        "open" => toggle_main(app),
        "quit" => app.exit(0),
        _ => {}
    });

    tray.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            position,
            ..
        } = event
        {
            // The panel always docks at the bottom-center of the user's
            // current monitor — so we just use the click as a hint for
            // which monitor we're on, not for the actual anchor point.
            let hint = PhysicalPosition::new(position.x, position.y);
            toggle_panel(tray.app_handle(), hint);
        }
    });

    // Drive the live menubar timer from JS-emitted `timer://changed` events.
    // The TimerState is a single managed singleton (see lib.rs).
    let listener_app = app.clone();
    app.listen_any("timer://changed", move |event| {
        let Ok(payload) = serde_json::from_str::<TimerChangedPayload>(event.payload()) else {
            return;
        };
        let state = listener_app.state::<TimerState>();
        match payload {
            TimerChangedPayload::Start { started_at }
            | TimerChangedPayload::Resume { started_at } => state.start(&listener_app, started_at),
            TimerChangedPayload::Pause { elapsed_seconds } => {
                state.pause(&listener_app, elapsed_seconds)
            }
            TimerChangedPayload::Stop => state.stop(&listener_app),
        }
    });

    Ok(())
}

/// Show / focus the panel docked at the bottom-center of the screen.
/// Used by the `Cmd+Shift+Space` global shortcut.
pub fn show_panel_at_tray<R: Runtime>(app: &AppHandle<R>) {
    // Use the tray-icon position only as a "which monitor?" hint.
    let hint = app
        .tray_by_id("main")
        .and_then(|tray| tray.rect().ok().flatten())
        .map(|rect| match rect.position {
            tauri::Position::Physical(p) => PhysicalPosition::new(p.x as f64, p.y as f64),
            tauri::Position::Logical(p) => PhysicalPosition::new(p.x, p.y),
        })
        .unwrap_or_else(|| PhysicalPosition::new(200.0, 30.0));
    toggle_panel(app, hint);
}

fn toggle_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            hide_panel(app);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn hide_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.hide();
    }
}

/// Toggle the panel — show docked at the bottom-center of the monitor
/// the `hint` falls on (Spotlight-style), hide if already visible.
fn toggle_panel<R: Runtime>(app: &AppHandle<R>, hint: PhysicalPosition<f64>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };

    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
        return;
    }

    let panel_size = panel.outer_size().unwrap_or_default();
    let panel_w = panel_size.width as f64;
    let panel_h = panel_size.height as f64;

    // Default to the primary monitor; override if the hint falls on a
    // specific monitor (multi-display setups).
    let mut anchor: Option<(f64, f64, f64, f64)> = None; // (mx, my, mw, mh)

    if let Ok(monitors) = panel.available_monitors() {
        for monitor in &monitors {
            let pos = monitor.position();
            let size = monitor.size();
            let mx = pos.x as f64;
            let my = pos.y as f64;
            let mw = size.width as f64;
            let mh = size.height as f64;
            if hint.x >= mx && hint.x <= mx + mw && hint.y >= my && hint.y <= my + mh {
                anchor = Some((mx, my, mw, mh));
                break;
            }
        }
        if anchor.is_none() {
            if let Ok(Some(primary)) = panel.primary_monitor() {
                let pos = primary.position();
                let size = primary.size();
                anchor = Some((
                    pos.x as f64,
                    pos.y as f64,
                    size.width as f64,
                    size.height as f64,
                ));
            }
        }
    }

    let (mx, my, mw, mh) = anchor.unwrap_or((0.0, 0.0, 1440.0, 900.0));
    // Bottom-center, with breathing room above the Dock.
    let x = mx + (mw - panel_w) / 2.0;
    let y = my + mh - panel_h - 96.0;

    let _ = panel.set_position(PhysicalPosition::new(x, y));
    let _ = panel.show();
    let _ = panel.set_focus();
}
