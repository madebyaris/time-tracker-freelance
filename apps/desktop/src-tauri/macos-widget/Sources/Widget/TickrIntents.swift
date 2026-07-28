import AppIntents
import AppKit

/// Opens a Tickr deep link without asking WidgetKit to launch the generic main
/// window first. The URL itself decides whether to show the app, show the Quick
/// Panel, or perform a timer action in the background.
private func openTickr(_ action: String) async {
    guard let url = URL(string: "tickr://\(action)") else { return }
    await MainActor.run {
        NSWorkspace.shared.open(url)
    }
}

struct OpenTickrIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Tickr"
    static let description = IntentDescription("Open the Tickr window.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await openTickr("open")
        return .result()
    }
}

struct OpenQuickPanelIntent: AppIntent {
    static let title: LocalizedStringResource = "New timer"
    static let description = IntentDescription("Open the Quick Panel to create and start a timer.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await openTickr("panel")
        return .result()
    }
}

struct PauseTimerIntent: AppIntent {
    static let title: LocalizedStringResource = "Pause timer"
    static let description = IntentDescription("Pause Tickr's running timer.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await openTickr("pause")
        return .result()
    }
}

struct ResumeTimerIntent: AppIntent {
    static let title: LocalizedStringResource = "Resume timer"
    static let description = IntentDescription("Resume Tickr's paused timer.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await openTickr("resume")
        return .result()
    }
}
