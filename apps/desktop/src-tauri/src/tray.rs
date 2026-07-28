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

/// Show / focus the panel, anchored the same way a tray click would.
/// Used by the quick-panel global shortcut.
pub fn show_panel_at_tray<R: Runtime>(app: &AppHandle<R>) {
    // Unlike a tray click, callers such as the global shortcut and
    // `tickr://panel` explicitly request that the panel be open. Do not toggle
    // it closed when it is already visible.
    if let Some(panel) = app.get_webview_window("panel") {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.set_focus();
            return;
        }
    }

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

/// Gap between the panel and the edge of the usable screen area.
const PANEL_MARGIN: f64 = 8.0;

/// The part of a monitor not covered by system chrome — menu bar and Dock on
/// macOS, the taskbar on Windows, panels on Linux.
struct WorkArea {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Toggle the panel, or hide it if already visible.
///
/// On macOS the menu bar is always at the top, so the tray icon's x is a real
/// anchor and the panel hangs beneath it. Everywhere else the tray lives in a
/// taskbar the user can move to any edge, so anchoring to the icon would put the
/// panel in an unpredictable place — it centres in the work area instead.
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
    let area = work_area_for(&panel, hint);

    let max_x = (area.x + area.width - panel_w - PANEL_MARGIN).max(area.x + PANEL_MARGIN);
    let (x, y) = if cfg!(target_os = "macos") {
        (
            (hint.x - panel_w / 2.0).clamp(area.x + PANEL_MARGIN, max_x),
            area.y + PANEL_MARGIN,
        )
    } else {
        (
            area.x + (area.width - panel_w) / 2.0,
            area.y + area.height - panel_h - PANEL_MARGIN,
        )
    };

    let _ = panel.set_position(PhysicalPosition::new(x, y));
    let _ = panel.show();
    let _ = panel.set_focus();
}

/// Work area of the monitor the `hint` lands on, falling back to the primary
/// monitor and finally to a conservative guess if the runtime tells us nothing.
///
/// Containment is tested against full monitor bounds rather than the work area,
/// because the tray icon itself sits *inside* the system chrome the work area
/// excludes.
fn work_area_for<R: Runtime>(
    panel: &tauri::WebviewWindow<R>,
    hint: PhysicalPosition<f64>,
) -> WorkArea {
    let containing = panel.available_monitors().ok().and_then(|monitors| {
        monitors.into_iter().find(|monitor| {
            let pos = monitor.position();
            let size = monitor.size();
            let (mx, my) = (pos.x as f64, pos.y as f64);
            hint.x >= mx
                && hint.x <= mx + size.width as f64
                && hint.y >= my
                && hint.y <= my + size.height as f64
        })
    });

    let monitor = containing.or_else(|| panel.primary_monitor().ok().flatten());

    monitor
        .map(|monitor| {
            let area = monitor.work_area();
            WorkArea {
                x: area.position.x as f64,
                y: area.position.y as f64,
                width: area.size.width as f64,
                height: area.size.height as f64,
            }
        })
        .unwrap_or(WorkArea {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
            height: 900.0,
        })
}
