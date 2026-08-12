import SwiftUI

/// The roster row's one age slot (`cockpit-roster-turn-clock.md`): a live Turn duration in the
/// running ink, an observed Session's `output … ago`, or the seen phrase every other row keeps.
/// Which of the three it draws was decided in the projection; this view claims nothing itself.
///
/// The timeline wraps ONLY the reading's own text. Ticking anything wider re-renders the row,
/// and a re-rendered row visibly restarts its siblings' animation mid-pass — the trap the
/// design's prototype hit first.
struct RosterTurnClock: View {
    @Environment(\.argo) private var argo

    let clock: SessionRosterProjection.Clock

    var body: some View {
        switch clock {
        case let .seen(phrase):
            reading { _ in phrase }
        case let .turn(startedAtMs):
            // The dot's own ink as a figure — the one running-ink text in the sidebar.
            reading { now in TurnClockPhrase.figure(seconds: seconds(since: startedAtMs, at: now)) }
                .foregroundStyle(ArgoOperationalState.running.tint(in: argo.color))
        case let .output(sinceMs):
            reading { now in
                "output \(TurnClockPhrase.figure(seconds: seconds(since: sinceMs, at: now))) ago"
            }
        }
    }

    /// One text for all three cases, so the slot cannot drift into two type treatments — the
    /// seen phrase rides the same timeline and ignores it. Digits are monospaced so the tick
    /// never wobbles the row.
    private func reading(_ words: @escaping (Date) -> String) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            Text(words(context.date))
                .argoText(ArgoTypography.rowMeta)
                .monospacedDigit()
                .lineLimit(1)
        }
    }

    private func seconds(since sinceMs: Int, at now: Date) -> Int {
        TurnClockPhrase.seconds(sinceMs: sinceMs, nowMs: now.epochMs)
    }
}

#Preview("Turn clock — the three readings of the one slot") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        RosterTurnClock(clock: .turn(startedAtMs: Date().epochMs - 252_000))
        RosterTurnClock(clock: .output(sinceMs: Date().epochMs - 12000))
        RosterTurnClock(clock: .seen("2m ago"))
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
