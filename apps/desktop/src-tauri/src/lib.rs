mod commands;
mod deep_links;
mod idle;
mod shortcuts;
mod timer_state;
mod tray;
mod widget;

use tauri_plugin_global_shortcut::ShortcutState;

use crate::shortcuts::ShortcutStatus;
use crate::timer_state::TimerState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    // Toggles the timer without forcing the main window open.
                    if shortcuts::toggle_timer().matches(shortcut) {
                        let _ = app.emit_to("main", "global-shortcut://toggle-timer", ());
                    }
                    // Summons the quick panel anchored on the tray icon.
                    if shortcuts::quick_panel().matches(shortcut) {
                        tray::show_panel_at_tray(app);
                    }
                })
                .build(),
        )
        .manage(deep_links::PendingTimerActions::default())
        .manage(TimerState::new())
        .manage(ShortcutStatus::new())
        .invoke_handler(tauri::generate_handler![
            commands::idle_seconds,
            commands::frontmost_app_stub,
            commands::calendar_stub,
            commands::show_window,
            commands::hide_window,
            commands::quit_app,
            commands::set_dock_icon_visible,
            deep_links::take_pending_timer_actions,
            shortcuts::shortcut_info,
            widget::write_widget_state,
            widget::widget_status
        ])
        .setup(|app| {
            // Tray icon — primary affordance on macOS
            tray::setup(app.handle())?;

            // Widget actions arrive through tickr:// URLs. Install this before
            // React mounts so cold-launch actions are queued rather than lost.
            deep_links::setup(app.handle())?;

            // Per-OS defaults; failures are recorded for Settings to surface.
            shortcuts::register(app.handle());

            apply_panel_vibrancy(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide to tray instead of quitting on close (macOS convention for menu bar apps)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Native blur behind the quick panel on macOS. Elsewhere the panel keeps its
/// CSS `backdrop-blur`, which is the only option available.
fn apply_panel_vibrancy<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    #[cfg(target_os = "macos")]
    if let Some(panel) = app.get_webview_window("panel") {
        if let Err(e) = window_vibrancy::apply_vibrancy(
            &panel,
            window_vibrancy::NSVisualEffectMaterial::HudWindow,
            Some(window_vibrancy::NSVisualEffectState::Active),
            Some(16.0),
        ) {
            log::warn!("Failed to apply panel vibrancy: {e}");
        }
    }

    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

// `emit_to` is on AppHandle, but our handler only has &AppHandle; bring in trait
use tauri::Emitter;
use tauri::Manager;
