/*!
 * System-wide idle time in seconds — how long since the user last touched
 * *anything*, not just Tickr.
 *
 * macOS reads the CoreGraphics event source timestamp; Windows reads
 * `GetLastInputInfo`. Both are declared inline rather than pulling in
 * `windows-sys` for two symbols. Any other platform reports 0, which the idle
 * watcher reads as "never idle" and so stays quiet instead of firing bogus
 * prompts.
 */

#[cfg(target_os = "macos")]
mod imp {
    // `CGEventSourceSecondsSinceLastEventType` — seconds since any system-wide
    // user input. See Apple's CGEventSource docs.
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state: u32, event_type: u32) -> f64;
    }

    // kCGEventSourceStateCombinedSessionState = 0
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
}

#[cfg(target_os = "windows")]
mod imp {
    #[repr(C)]
    struct LastInputInfo {
        cb_size: u32,
        dw_time: u32,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetTickCount() -> u32;
    }

    pub fn system_idle_seconds() -> u64 {
        let mut info = LastInputInfo {
            cb_size: std::mem::size_of::<LastInputInfo>() as u32,
            dw_time: 0,
        };
        unsafe {
            if GetLastInputInfo(&mut info) == 0 {
                return 0;
            }
            // Both tick counts wrap every ~49.7 days; wrapping_sub keeps the
            // difference correct across the rollover.
            u64::from(GetTickCount().wrapping_sub(info.dw_time)) / 1000
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    pub fn system_idle_seconds() -> u64 {
        0
    }
}

pub fn system_idle_seconds() -> u64 {
    imp::system_idle_seconds()
}
