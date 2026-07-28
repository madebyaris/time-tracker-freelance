import Foundation

/// Snapshot of Tickr's timer, written by the app and read by the widget.
///
/// The wire format is owned by `src-tauri/src/widget.rs`; the two must stay in
/// step. Decoding is deliberately forgiving — an unreadable or half-written file
/// yields `.idle` rather than an error state, because a widget showing "no timer"
/// is better than one showing a failure.
struct TickrState: Codable {
    /// Bumped when the shape changes incompatibly. Unknown versions are ignored.
    var version: Int
    /// Epoch milliseconds when the app last wrote this file.
    var updatedAt: Double
    var running: Bool
    var paused: Bool
    /// Epoch milliseconds, already shifted forward by accumulated pause time, so
    /// elapsed is simply `now - startedAt`.
    var startedAt: Double?
    /// Frozen elapsed time while paused, since the clock must not advance.
    var pausedElapsedSeconds: Int?
    var entryDescription: String?
    var projectName: String?
    var clientName: String?
    var todayTrackedSeconds: Int
    var todayBillableSeconds: Int

    static let currentVersion = 1

    static let idle = TickrState(
        version: currentVersion,
        updatedAt: 0,
        running: false,
        paused: false,
        startedAt: nil,
        pausedElapsedSeconds: nil,
        entryDescription: nil,
        projectName: nil,
        clientName: nil,
        todayTrackedSeconds: 0,
        todayBillableSeconds: 0
    )

    var startDate: Date? {
        guard let startedAt else { return nil }
        return Date(timeIntervalSince1970: startedAt / 1000)
    }

    /// What the timer is being spent on, best-effort.
    var subject: String {
        if let name = entryDescription, !name.isEmpty { return name }
        if let project = projectName, !project.isEmpty { return project }
        if let client = clientName, !client.isEmpty { return client }
        return "Tracking"
    }

    /// The project/client line under the subject, omitted when it would repeat it.
    var context: String? {
        let parts = [projectName, clientName].compactMap { value -> String? in
            guard let value, !value.isEmpty, value != subject else { return nil }
            return value
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

enum WidgetStateStore {
    /// The app is not sandboxed, so it writes to the user's real Application
    /// Support directory. The widget *is* sandboxed and reaches this path through
    /// a temporary-exception entitlement — see TickrWidget.entitlements.
    static let directoryName = "Library/Application Support/Tickr"
    static let fileName = "widget-state.json"

    /// Inside a sandbox `NSHomeDirectory()` returns the container, not the user's
    /// home, so the real path has to come from the password database.
    static var realHomeDirectory: URL {
        if let entry = getpwuid(getuid()), let dir = entry.pointee.pw_dir {
            return URL(fileURLWithPath: String(cString: dir))
        }
        return URL(fileURLWithPath: NSHomeDirectory())
    }

    static var stateURL: URL {
        realHomeDirectory
            .appendingPathComponent(directoryName, isDirectory: true)
            .appendingPathComponent(fileName)
    }

    static func load() -> TickrState {
        guard
            let data = try? Data(contentsOf: stateURL),
            let state = try? JSONDecoder().decode(TickrState.self, from: data),
            state.version == TickrState.currentVersion
        else {
            return .idle
        }
        return state
    }
}
