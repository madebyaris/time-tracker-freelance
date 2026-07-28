/*!
 * Live tray timer driver.
 *
 * The desktop JS emits `timer://changed` whenever a timer starts or stops.
 * `tray.rs` listens for that event and routes the payload here. While a timer
 * is running we keep a single 1Hz tokio task alive that re-formats the elapsed
 * duration and pushes it to the tray.
 *
 * Only macOS renders text beside a tray icon, so elsewhere the same string goes
 * into the tooltip instead — hovering the icon is then the way to read elapsed
 * time. See `set_tray_label`.
 *
 * Cancellation is idempotent: starting twice in a row aborts the previous
 * task before spawning a new one, so JS HMR / multiple window reloads cannot
 * leak tickers.
 */

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Runtime};

pub struct TimerState {
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            handle: Mutex::new(None),
        }
    }
}

impl TimerState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Begin showing the live duration in the tray.
    pub fn start<R: Runtime>(&self, app: &AppHandle<R>, started_at_ms: i64) {
        self.abort();

        // Set the initial label synchronously so the tray updates the very
        // first frame instead of waiting one second for the ticker.
        set_tray_label(app, Some(&format_elapsed(elapsed_seconds(started_at_ms))));

        let app_clone = app.clone();
        let handle = tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
            // skip the first immediate tick — we already set the label above.
            interval.tick().await;
            loop {
                interval.tick().await;
                let secs = elapsed_seconds(started_at_ms);
                set_tray_label(&app_clone, Some(&format_elapsed(secs)));
            }
        });

        if let Ok(mut guard) = self.handle.lock() {
            *guard = Some(handle);
        }
    }

    /// Stop ticking and clear the tray text back to the icon-only state.
    pub fn stop<R: Runtime>(&self, app: &AppHandle<R>) {
        self.abort();
        set_tray_label(app, None);
    }

    /// Freeze the tray at the given elapsed seconds, prefixed with `⏸`.
    /// The user keeps seeing how much time has been captured even while
    /// they're paused, but the number does not advance.
    pub fn pause<R: Runtime>(&self, app: &AppHandle<R>, elapsed_seconds: i64) {
        self.abort();
        set_tray_label(app, Some(&format!("⏸ {}", format_elapsed(elapsed_seconds))));
    }

    fn abort(&self) {
        if let Ok(mut guard) = self.handle.lock() {
            if let Some(handle) = guard.take() {
                handle.abort();
            }
        }
    }
}

/// Push the elapsed-time string to wherever the platform can show it.
///
/// `set_title` is a no-op on Windows and Linux — those tray icons have no text
/// slot at all — so the tooltip carries the timer there instead.
fn set_tray_label<R: Runtime>(app: &AppHandle<R>, text: Option<&str>) {
    let Some(tray) = app.tray_by_id("main") else {
        return;
    };

    #[cfg(target_os = "macos")]
    {
        let _ = tray.set_title(text);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let tooltip = match text {
            Some(elapsed) => format!("Tickr — {elapsed}"),
            None => "Tickr".to_string(),
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

fn elapsed_seconds(started_at_ms: i64) -> i64 {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(started_at_ms);
    ((now_ms - started_at_ms) / 1000).max(0)
}

/// `m:ss` for the first hour, then `h:mm`.
fn format_elapsed(total_seconds: i64) -> String {
    if total_seconds < 60 * 60 {
        let m = total_seconds / 60;
        let s = total_seconds % 60;
        format!("{m}:{s:02}")
    } else {
        let h = total_seconds / 3600;
        let m = (total_seconds % 3600) / 60;
        format!("{h}:{m:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::format_elapsed;

    #[test]
    fn formats_under_one_hour_as_mss() {
        assert_eq!(format_elapsed(0), "0:00");
        assert_eq!(format_elapsed(7), "0:07");
        assert_eq!(format_elapsed(83), "1:23");
        assert_eq!(format_elapsed(59 * 60 + 59), "59:59");
    }

    #[test]
    fn formats_over_one_hour_as_hmm() {
        assert_eq!(format_elapsed(60 * 60), "1:00");
        assert_eq!(format_elapsed(60 * 60 + 23 * 60), "1:23");
        assert_eq!(format_elapsed(9 * 3600 + 5 * 60), "9:05");
    }
}
