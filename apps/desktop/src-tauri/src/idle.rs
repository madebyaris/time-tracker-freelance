// macOS system idle: `CGEventSourceSecondsSinceLastEventType` — seconds since
// any user input system-wide. See Apple CG docs (CGEventSource).
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state: u32, event_type: u32) -> f64;
}

// kCGEventSourceStateCombinedSessionState = 0
// kCGEventSourceStateHIDSystemState   = 1
const CG_EVENT_SOURCE_STATE_COMBINED_SESSION: u32 = 0;
// kCGEventNull = 0 — "time since the last time that any input … was made" (per Apple)
const CG_EVENT_NULL: u32 = 0;

pub fn system_idle_seconds() -> u64 {
    unsafe {
        let secs = CGEventSourceSecondsSinceLastEventType(
            CG_EVENT_SOURCE_STATE_COMBINED_SESSION,
            CG_EVENT_NULL,
        );
        if !secs.is_finite() || secs < 0.0 {
            return 0;
        }
        secs as u64
    }
}
