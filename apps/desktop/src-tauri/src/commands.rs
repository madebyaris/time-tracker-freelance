use tauri::{AppHandle, Manager, Runtime};

/// Reserved for app / window auto-tracking (requires Accessibility permission on macOS).
/// Returns a placeholder when permission is not granted.
#[tauri::command]
pub fn frontmost_app_stub() -> String {
    "unknown".to_string()
}

/// Reserved for read-only EventKit / calendar (requires native bridge; not yet wired).
#[tauri::command]
pub fn calendar_stub() -> Vec<String> {
    vec![]
}

/// Seconds since the last system-wide user input. Implemented on macOS and
/// Windows; returns 0 elsewhere, which the idle watcher reads as "not idle".
#[tauri::command]
pub fn idle_seconds() -> u64 {
    crate::idle::system_idle_seconds()
}

#[tauri::command]
pub fn show_window<R: Runtime>(app: AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[tauri::command]
pub fn hide_window<R: Runtime>(app: AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

/// Show or hide the macOS Dock icon.
///
/// Tickr is tray-first, so some people want it out of the Dock entirely. It is
/// opt-in because hiding the icon also removes the app from Cmd-Tab. No-op on
/// other platforms.
#[tauri::command]
pub fn set_dock_icon_visible<R: Runtime>(app: AppHandle<R>, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        app.set_dock_visibility(visible).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, visible);
        Ok(())
    }
}
