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

/// Returns macOS system idle time in seconds. Stub on non-macOS platforms.
#[tauri::command]
pub fn idle_seconds() -> u64 {
    #[cfg(target_os = "macos")]
    {
        crate::idle::system_idle_seconds()
    }
    #[cfg(not(target_os = "macos"))]
    {
        0
    }
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
