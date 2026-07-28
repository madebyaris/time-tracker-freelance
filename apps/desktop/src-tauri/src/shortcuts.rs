/*!
 * Global shortcut defaults, per platform, plus whether they actually registered.
 *
 * Two reasons this is not just two constants in `lib.rs`:
 *
 *  - The macOS pair (`⌥⌘T` / `⇧⌘Space`) uses the Super key, which Windows
 *    reserves for the shell. Windows and Linux need their own defaults.
 *  - Registration fails silently when another app already owns a combination.
 *    Failures are collected here so Settings can tell the user instead of the
 *    shortcut simply never working.
 *
 * The display label travels with the definition so the UI never hardcodes a
 * modifier glyph that disagrees with what was registered.
 */

use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub struct ShortcutDef {
    pub modifiers: Modifiers,
    pub code: Code,
    /// Rendered with platform-native modifier glyphs.
    pub label: &'static str,
}

impl ShortcutDef {
    pub fn shortcut(&self) -> Shortcut {
        Shortcut::new(Some(self.modifiers), self.code)
    }

    pub fn matches(&self, shortcut: &Shortcut) -> bool {
        shortcut.matches(self.modifiers, self.code)
    }
}

/// Start / stop the timer without bringing a window forward.
pub fn toggle_timer() -> ShortcutDef {
    #[cfg(target_os = "macos")]
    let def = ShortcutDef {
        modifiers: Modifiers::ALT | Modifiers::SUPER,
        code: Code::KeyT,
        label: "⌥⌘T",
    };
    #[cfg(not(target_os = "macos"))]
    let def = ShortcutDef {
        modifiers: Modifiers::CONTROL | Modifiers::ALT,
        code: Code::KeyT,
        label: "Ctrl+Alt+T",
    };
    def
}

/// Summon the quick panel.
pub fn quick_panel() -> ShortcutDef {
    #[cfg(target_os = "macos")]
    let def = ShortcutDef {
        modifiers: Modifiers::SHIFT | Modifiers::SUPER,
        code: Code::Space,
        label: "⇧⌘Space",
    };
    #[cfg(not(target_os = "macos"))]
    let def = ShortcutDef {
        modifiers: Modifiers::CONTROL | Modifiers::ALT,
        code: Code::Space,
        label: "Ctrl+Alt+Space",
    };
    def
}

#[derive(Clone, serde::Serialize)]
pub struct ShortcutIssue {
    pub action: String,
    pub accelerator: String,
    pub error: String,
}

#[derive(Default)]
pub struct ShortcutStatus {
    issues: Mutex<Vec<ShortcutIssue>>,
}

impl ShortcutStatus {
    pub fn new() -> Self {
        Self::default()
    }

    fn record(&self, action: &str, accelerator: &str, error: String) {
        if let Ok(mut issues) = self.issues.lock() {
            issues.push(ShortcutIssue {
                action: action.to_string(),
                accelerator: accelerator.to_string(),
                error,
            });
        }
    }

    fn snapshot(&self) -> Vec<ShortcutIssue> {
        self.issues
            .lock()
            .map(|issues| issues.clone())
            .unwrap_or_default()
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutInfo {
    pub toggle_timer: String,
    pub quick_panel: String,
    pub issues: Vec<ShortcutIssue>,
}

/// Register both defaults, remembering anything the OS refused.
pub fn register<R: Runtime>(app: &AppHandle<R>) {
    let status = app.state::<ShortcutStatus>();
    for (action, def) in [
        ("Toggle timer", toggle_timer()),
        ("Quick panel", quick_panel()),
    ] {
        if let Err(e) = app.global_shortcut().register(def.shortcut()) {
            log::warn!("Failed to register {action} shortcut ({}): {e}", def.label);
            status.record(action, def.label, e.to_string());
        }
    }
}

#[tauri::command]
pub fn shortcut_info<R: Runtime>(app: AppHandle<R>) -> ShortcutInfo {
    ShortcutInfo {
        toggle_timer: toggle_timer().label.to_string(),
        quick_panel: quick_panel().label.to_string(),
        issues: app.state::<ShortcutStatus>().snapshot(),
    }
}
