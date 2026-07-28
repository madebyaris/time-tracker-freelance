//! Routes `tickr://` widget actions into the running desktop app.
//!
//! Opening a URL can cold-launch Tickr before the React timer store is ready.
//! Timer actions therefore enter a small queue owned by Rust. The frontend
//! drains it after initialization and whenever the router emits a wake-up event.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_deep_link::DeepLinkExt;

const TIMER_ACTION_PENDING: &str = "deep-link://timer-action-pending";

#[derive(Default)]
pub struct PendingTimerActions(Mutex<Vec<String>>);

impl PendingTimerActions {
    fn push(&self, action: &str) {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .push(action.to_owned());
    }

    fn take(&self) -> Vec<String> {
        std::mem::take(
            &mut *self
                .0
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()),
        )
    }
}

/// Installs handlers for both a cold-launch URL and URLs opened while Tickr is
/// already running.
pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri_plugin_deep_link::Result<()> {
    if let Some(urls) = app.deep_link().get_current()? {
        for url in urls {
            route(app, url.as_str());
        }
    }

    let app_handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            route(&app_handle, url.as_str());
        }
    });

    Ok(())
}

fn route<R: Runtime>(app: &AppHandle<R>, url: &str) {
    let Some(action) = action_from_url(url) else {
        log::warn!("Ignoring unknown Tickr deep link: {url}");
        return;
    };

    match action.as_str() {
        "open" => crate::commands::show_window(app.clone()),
        "panel" => crate::tray::show_panel_at_tray(app),
        "pause" | "resume" => {
            app.state::<PendingTimerActions>().push(&action);
            let _ = app.emit_to("main", TIMER_ACTION_PENDING, ());
        }
        _ => log::warn!("Ignoring unknown Tickr deep link: {url}"),
    }
}

fn action_from_url(url: &str) -> Option<String> {
    // In `tickr://pause`, "pause" is the URL host. Accept a path component too,
    // which makes hand-testing with `tickr:///pause` behave the same way.
    let action = url
        .strip_prefix("tickr://")
        .unwrap_or_default()
        .trim_start_matches('/')
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    if action.is_empty() {
        None
    } else {
        Some(action)
    }
}

/// Atomically drains timer actions queued by deep links. The queue makes actions
/// reliable across a cold launch, when the URL can arrive before React mounts.
#[tauri::command]
pub fn take_pending_timer_actions<R: Runtime>(app: AppHandle<R>) -> Vec<String> {
    app.state::<PendingTimerActions>().take()
}

#[cfg(test)]
mod tests {
    use super::{action_from_url, PendingTimerActions};

    #[test]
    fn parses_host_and_path_forms() {
        assert_eq!(action_from_url("tickr://pause").as_deref(), Some("pause"));
        assert_eq!(
            action_from_url("tickr:///resume?source=widget").as_deref(),
            Some("resume")
        );
        assert_eq!(action_from_url("https://pause"), None);
    }

    #[test]
    fn pending_actions_preserve_order_and_drain_once() {
        let pending = PendingTimerActions::default();
        pending.push("pause");
        pending.push("resume");

        assert_eq!(pending.take(), vec!["pause", "resume"]);
        assert!(pending.take().is_empty());
    }
}
