mod tray;
mod commands;
#[cfg(target_os = "macos")]
mod idle;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        // ⌥⌘T toggles the timer (handled by JS)
                        if shortcut.matches(Modifiers::ALT | Modifiers::SUPER, Code::KeyT) {
                            let _ = app.emit_to("main", "global-shortcut://toggle-timer", ());
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::idle_seconds,
            commands::frontmost_app_stub,
            commands::calendar_stub,
            commands::show_window,
            commands::hide_window,
            commands::quit_app
        ])
        .setup(|app| {
            // Tray icon — primary affordance on macOS
            tray::setup(app.handle())?;

            // Register the global toggle shortcut
            let toggle = Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyT);
            if let Err(e) = app.global_shortcut().register(toggle) {
                log::warn!("Failed to register global shortcut: {e}");
            }

            // Show window on first launch only; subsequent launches start hidden in tray.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

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

// `emit_to` is on AppHandle, but our handler only has &AppHandle; bring in trait
use tauri::Emitter;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
