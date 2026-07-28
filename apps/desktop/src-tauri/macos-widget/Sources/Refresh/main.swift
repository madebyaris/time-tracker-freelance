// Nudges WidgetKit to re-read the state file.
//
// This exists as a separate binary because WidgetCenter is a Swift/ObjC API and
// the host app is Rust. It must live inside Tickr.app/Contents/MacOS/ so that
// `Bundle.main` resolves to Tickr.app — WidgetCenter refuses to reload widgets
// it doesn't consider the caller to own.
//
// Spawned by `widget.rs` on every timer state change.

import Foundation
import WidgetKit

let kind = "app.tickr.timer"

if #available(macOS 14.0, *) {
    WidgetCenter.shared.reloadTimelines(ofKind: kind)
    // reloadTimelines is a fire-and-forget XPC message; exiting immediately can
    // tear the connection down before it is delivered.
    Thread.sleep(forTimeInterval: 0.25)
}
