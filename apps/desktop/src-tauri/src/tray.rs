use tauri::Emitter;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, Runtime,
};

/**
 * Builds the menu bar tray icon.
 *
 *  - Left click  → toggles the small "Quick Timer" popover positioned
 *                   directly under the tray icon (Toggl-style).
 *  - Right click → opens the classic context menu (Show/Hide, Start, Stop, Quit).
 *
 * The popover is a separate borderless transparent window declared in
 * tauri.conf.json with label `panel`. Both windows share the same SQLite
 * database and stay in sync via the `timer://changed` event.
 */
pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start timer", true, Some("Cmd+Alt+T"))?;
    let stop = MenuItem::with_id(app, "stop", "Stop timer", true, Some("Cmd+Alt+T"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tickr", true, Some("Cmd+Q"))?;

    let menu = Menu::with_items(app, &[&toggle, &start, &stop, &separator, &quit])?;

    let tray = app.tray_by_id("main").ok_or_else(|| {
        tauri::Error::AssetNotFound("tray icon 'main' missing from tauri.conf.json".into())
    })?;

    // Right-click opens the menu; left click is reserved for the popover.
    // (`menuOnLeftClick: false` is set in tauri.conf.json.)
    tray.set_menu(Some(menu))?;
    tray.on_menu_event(|app, event| match event.id().0.as_str() {
        "toggle" => toggle_main(app),
        "start" => {
            let _ = app.emit_to("main", "tray://start", ());
        }
        "stop" => {
            let _ = app.emit_to("main", "tray://stop", ());
            let _ = app.emit_to("panel", "tray://stop", ());
        }
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
            // Anchor at the click point (menu bar). Position is physical.
            let anchor = PhysicalPosition::new(position.x, position.y);
            toggle_panel(tray.app_handle(), anchor);
        }
    });

    Ok(())
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

/// Toggle the panel (tray popover) — show under the tray icon, hide if visible.
fn toggle_panel<R: Runtime>(app: &AppHandle<R>, anchor: PhysicalPosition<f64>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };

    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
        return;
    }

    // Center the panel horizontally on the tray-icon anchor and tuck it
    // just under the menu bar. Coordinates from the tray event are physical.
    let panel_size = panel.outer_size().unwrap_or_default();
    let panel_w = panel_size.width as f64;

    let mut x = anchor.x - panel_w / 2.0;
    let y = anchor.y + 4.0;

    // Keep on the monitor that contains the anchor.
    if let Ok(monitors) = panel.available_monitors() {
        for monitor in &monitors {
            let pos = monitor.position();
            let size = monitor.size();
            let mx = pos.x as f64;
            let my = pos.y as f64;
            let mw = size.width as f64;
            let mh = size.height as f64;
            if anchor.x >= mx && anchor.x <= mx + mw && anchor.y >= my && anchor.y <= my + mh {
                let min_x = mx + 6.0;
                let max_x = mx + mw - panel_w - 6.0;
                if x < min_x {
                    x = min_x;
                }
                if x > max_x {
                    x = max_x;
                }
                break;
            }
        }
    }

    let _ = panel.set_position(PhysicalPosition::new(x, y));
    let _ = panel.show();
    let _ = panel.set_focus();
}
