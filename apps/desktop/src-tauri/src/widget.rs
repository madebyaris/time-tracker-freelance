/*!
 * Bridge to the macOS WidgetKit widget.
 *
 * The widget cannot read Tickr's SQLite database: app extensions are always
 * sandboxed, and the usual escape hatch — an App Group container — is keyed on a
 * Team ID that only an Apple-issued certificate provides. Ad-hoc signed builds
 * have no Team ID, so App Groups are unavailable.
 *
 * Instead the app writes a small JSON snapshot to
 * `~/Library/Application Support/Tickr/widget-state.json`, and the widget reads
 * it through a sandbox temporary-exception entitlement. Temporary exceptions need
 * no provisioning profile, so this works with ad-hoc signing and without any
 * Apple Developer Program membership.
 *
 * The snapshot is assembled in the frontend rather than here, because only the
 * JS layer knows project and client names and today's rolled-up totals. See
 * `src/lib/widget-bridge.ts`. The wire format is mirrored in
 * `macos-widget/Sources/Shared/WidgetState.swift`.
 */

use serde::{Deserialize, Serialize};

/// Bump when the shape changes incompatibly; the Swift side ignores versions it
/// does not recognise, so a mismatched pair degrades to an idle widget.
const STATE_VERSION: u32 = 1;
const STATE_DIR: &str = "Library/Application Support/Tickr";
const STATE_FILE: &str = "widget-state.json";
const HELPER_NAME: &str = "tickr-widget-refresh";
const APPEX_RELATIVE_PATH: &str = "../PlugIns/TickrWidget.appex";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSnapshot {
    pub running: bool,
    pub paused: bool,
    /// Epoch milliseconds, already shifted forward by accumulated pause time, so
    /// the widget can render elapsed time as `now - startedAt` with no knowledge
    /// of pauses.
    pub started_at: Option<f64>,
    /// Frozen elapsed time while paused.
    pub paused_elapsed_seconds: Option<i64>,
    pub entry_description: Option<String>,
    pub project_name: Option<String>,
    pub client_name: Option<String>,
    pub today_tracked_seconds: i64,
    pub today_billable_seconds: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredState {
    version: u32,
    updated_at: f64,
    #[serde(flatten)]
    snapshot: WidgetSnapshot,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetStatus {
    /// The platform can host a WidgetKit widget at all.
    pub supported: bool,
    /// An `.appex` is actually present in this build.
    pub embedded: bool,
}

/// Write the snapshot, optionally asking WidgetKit to re-read it. No-op off macOS.
///
/// `refresh` is separate from the write because WidgetKit budgets reloads to
/// roughly tens per day. Timer start/pause/stop earns a reload; a periodic
/// refresh of today's totals only updates the file and lets the widget pick it up
/// on its own next timeline.
#[tauri::command]
pub fn write_widget_state(snapshot: WidgetSnapshot, refresh: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::write_state(&snapshot).map_err(|e| e.to_string())?;
        if refresh {
            macos::refresh_widgets();
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (snapshot, refresh);
        Ok(())
    }
}

/// Lets Settings explain *why* no widget is showing up — a dev build has no
/// bundle, so no extension, and macOS only offers widgets from installed apps.
#[tauri::command]
pub fn widget_status() -> WidgetStatus {
    #[cfg(target_os = "macos")]
    {
        WidgetStatus {
            supported: true,
            embedded: macos::appex_path().map(|p| p.is_dir()).unwrap_or(false),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        WidgetStatus {
            supported: false,
            embedded: false,
        }
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use std::io::Write;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        StoredState, WidgetSnapshot, APPEX_RELATIVE_PATH, HELPER_NAME, STATE_DIR, STATE_FILE,
        STATE_VERSION,
    };

    fn state_dir() -> std::io::Result<PathBuf> {
        let home =
            std::env::var_os("HOME").ok_or_else(|| std::io::Error::other("HOME is not set"))?;
        Ok(PathBuf::from(home).join(STATE_DIR))
    }

    fn now_ms() -> f64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as f64)
            .unwrap_or(0.0)
    }

    pub fn write_state(snapshot: &WidgetSnapshot) -> std::io::Result<()> {
        let dir = state_dir()?;
        std::fs::create_dir_all(&dir)?;

        let stored = StoredState {
            version: STATE_VERSION,
            updated_at: now_ms(),
            snapshot: snapshot.clone(),
        };
        let json = serde_json::to_vec(&stored).map_err(std::io::Error::other)?;

        // Write to a temp file and rename, so the widget can never observe a
        // half-written file — reads happen on the daemon's schedule, not ours.
        let tmp = dir.join(".widget-state.json.tmp");
        {
            let mut file = std::fs::File::create(&tmp)?;
            file.write_all(&json)?;
            file.sync_all()?;
        }
        std::fs::rename(tmp, dir.join(STATE_FILE))
    }

    pub fn appex_path() -> Option<PathBuf> {
        let exe = std::env::current_exe().ok()?;
        Some(exe.with_file_name(APPEX_RELATIVE_PATH))
    }

    /// WidgetKit reloads are triggered by a small Swift helper: `WidgetCenter` is
    /// an Objective-C API and refuses callers it doesn't consider the widget's
    /// owner. The helper lives in `Contents/MacOS/` so `Bundle.main` resolves to
    /// Tickr.app. A `tauri dev` run has no bundle, hence no helper, hence nothing
    /// to do.
    pub fn refresh_widgets() {
        let Ok(exe) = std::env::current_exe() else {
            return;
        };
        let helper = exe.with_file_name(HELPER_NAME);
        if !helper.is_file() {
            return;
        }
        std::thread::spawn(move || {
            if let Ok(mut child) = std::process::Command::new(helper).spawn() {
                let _ = child.wait();
            }
        });
    }
}
