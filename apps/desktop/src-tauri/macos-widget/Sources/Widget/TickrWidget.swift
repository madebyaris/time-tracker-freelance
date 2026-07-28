import SwiftUI
import WidgetKit

/// Widget kind, also used by `tickr-widget-refresh` to target reloads.
let tickrWidgetKind = "app.tickr.timer"

struct TickrEntry: TimelineEntry {
    let date: Date
    let state: TickrState
}

struct TickrProvider: TimelineProvider {
    func placeholder(in context: Context) -> TickrEntry {
        TickrEntry(date: Date(), state: .idle)
    }

    func getSnapshot(in context: Context, completion: @escaping (TickrEntry) -> Void) {
        completion(TickrEntry(date: Date(), state: WidgetStateStore.load()))
    }

    /// A single entry is enough: `Text(timerInterval:)` advances the running clock
    /// without any reload, and the app pushes a reload whenever the state actually
    /// changes. WidgetKit's refresh budget makes per-second timelines impossible
    /// anyway. The hourly follow-up is only a safety net for a missed push.
    func getTimeline(in context: Context, completion: @escaping (Timeline<TickrEntry>) -> Void) {
        let entry = TickrEntry(date: Date(), state: WidgetStateStore.load())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
    }
}

private func formatHoursMinutes(_ seconds: Int) -> String {
    let clamped = max(0, seconds)
    return "\(clamped / 3600)h \(String(format: "%02d", (clamped % 3600) / 60))m"
}

struct TickrWidgetView: View {
    var entry: TickrEntry
    @Environment(\.widgetFamily) private var family

    private var state: TickrState { entry.state }

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 6) {
            header

            if state.running {
                elapsed
                    .font(.system(size: family == .systemSmall ? 26 : 34, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                Text(state.subject)
                    .font(.footnote)
                    .fontWeight(.medium)
                    .lineLimit(family == .systemSmall ? 1 : 2)

                if family != .systemSmall, let context = state.context {
                    Text(context)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Text(formatHoursMinutes(state.todayTrackedSeconds))
                    .font(.system(size: family == .systemSmall ? 26 : 34, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                Text("tracked today")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            totals
            actions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // The widget background is the Open affordance. Explicit controls below
        // override it for Pause, Resume, and New Timer.
        .widgetURL(URL(string: "tickr://open"))
    }

    private var header: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(statusColor)
                .frame(width: 7, height: 7)
            Text(statusLabel)
                .font(.caption2)
                .fontWeight(.semibold)
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
        }
    }

    /// Ticks locally so the widget stays live without burning reload budget.
    /// A paused timer renders as frozen text — a `pauseTime` interval would still
    /// re-render on every state restore, and the number must not move.
    @ViewBuilder
    private var elapsed: some View {
        if state.paused {
            Text(formatHoursMinutes(state.pausedElapsedSeconds ?? 0))
        } else if let start = state.startDate {
            Text(timerInterval: start...Date.distantFuture, countsDown: false)
        } else {
            Text("0h 00m")
        }
    }

    private var totals: some View {
        HStack(spacing: 4) {
            Text("Today")
                .foregroundStyle(.tertiary)
            Text(formatHoursMinutes(state.todayTrackedSeconds))
                .foregroundStyle(.secondary)
            if state.todayBillableSeconds > 0 {
                Text("·")
                    .foregroundStyle(.tertiary)
                Text("\(formatHoursMinutes(state.todayBillableSeconds)) billable")
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .font(.caption2)
        .monospacedDigit()
        .minimumScaleFactor(0.7)
        .lineLimit(1)
    }

    @ViewBuilder
    private var actions: some View {
        // Plain text labels — SF Symbols like `arrow.up.right.square` read as
        // noisy glyphs at widget size (they look like tiny glasses).
        HStack(spacing: 6) {
            if family != .systemSmall {
                Button(intent: OpenTickrIntent()) {
                    Text("Open")
                        .frame(maxWidth: .infinity)
                }
            }

            if state.running {
                if state.paused {
                    Button(intent: ResumeTimerIntent()) {
                        Text("Resume")
                            .frame(maxWidth: .infinity)
                    }
                } else {
                    Button(intent: PauseTimerIntent()) {
                        Text("Pause")
                            .frame(maxWidth: .infinity)
                    }
                }
            } else {
                Button(intent: OpenQuickPanelIntent()) {
                    Text("New")
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .font(.caption)
        .fontWeight(.medium)
        .buttonStyle(.bordered)
        .controlSize(.small)
    }

    private var statusColor: Color {
        if state.paused { return .orange }
        return state.running ? .green : .secondary
    }

    private var statusLabel: String {
        if state.paused { return "Paused" }
        return state.running ? "Tracking" : "Idle"
    }
}

struct TickrTimerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: tickrWidgetKind, provider: TickrProvider()) { entry in
            TickrWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Tickr")
        .description("Your running timer and today's tracked time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct TickrWidgetBundle: WidgetBundle {
    var body: some Widget {
        TickrTimerWidget()
    }
}
