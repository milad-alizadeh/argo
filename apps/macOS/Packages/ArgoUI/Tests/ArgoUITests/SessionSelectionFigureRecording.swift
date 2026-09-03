import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Foundation
import Testing

/// The harness that RECORDS what a click on a roster row costs, rather than gating on it —
/// `MinimapFigureRecording`'s shape, and for its reason (ADR-0028 Rule 8).
///
/// It asserts nothing. Thread CPU is only approximately load-independent (`CostMeasure`), so the
/// seconds it prints bind nothing; `SessionSelectionCostTests` is the gate, and it is counts. What
/// this answers is the question no count can: whether taking the reading off the click pass was
/// worth doing at all. Off by default, so the `macos` job does not pay for a measurement nobody
/// reads:
///
/// ```sh
/// ARGO_RECORD_FIGURES=1 swift test --filter SessionSelectionFigureRecording
/// ```
///
/// **The two arms are the shipped shell, and they are alike.** Before is a shell whose first pass
/// has not landed, which reads INLINE by design (`DrawnSession.hasDrawn`) — the pass exactly as it
/// was. After is the same shell settled, so the switch is deferred. Both are warmed by the same
/// number of layout passes, `warm()` against `settle()`, so what separates them is the deferral and
/// not the warm-up. Interleaved and least-of-N because a machine drifts over the length of a run.
@MainActor
@Suite("Session selection figures", .serialized, .enabled(if: ProcessInfo.processInfo
        .environment["ARGO_RECORD_FIGURES"] != nil))
struct SessionSelectionFigureRecording {
    /// Both sizes, because the finding is a fold at each rather than one number: the reading is
    /// what grows with the transcript, and it is the reading that left the pass.
    @Test
    func `record what a click on a roster row costs`() async {
        for scale in [1, 8] {
            let roster = Self.roster(scale: scale)
            var inline: [Double] = []
            var deferred: [Double] = []
            _ = await Self.inline(roster)
            _ = await Self.deferred(roster)
            for _ in 0 ..< Self.rounds {
                let one = await Self.inline(roster)
                let other = await Self.deferred(roster)
                inline.append(one)
                deferred.append(other)
            }
            Self.record(events: roster.sessions[0].events.count, inline, deferred)
        }
    }

    /// A slug and fields rather than a sentence, for `MinimapFigureRecording`'s reason: a run with
    /// a line missing is a case that failed or was skipped, and prose hides that.
    private static func record(events: Int, _ inline: [Double], _ deferred: [Double]) {
        let before = inline.min() ?? 0
        let after = deferred.min() ?? 0
        print("""
        selection-click events=\(events) \
        before=\(Self.ms(before)) after=\(Self.ms(after)) \
        fold=\(String(format: "%.2f", after > 0 ? before / after : 0))x
        """)
    }

    private static func ms(_ seconds: Double) -> String {
        String(format: "%.2fms", seconds * 1000)
    }

    /// Least of nine, interleaved. CPU noise is one-sided, so the minimum converges on what the
    /// pass COSTS from above.
    private static let rounds = 9

    /// The click pass as it was: a shell whose catch-up has not landed reads inline, which is the
    /// shipped code doing exactly what it did before the deferral.
    private static func inline(_ roster: CockpitPresentation) async -> Double {
        SessionsRoomReadingCache.forget()
        let shell = HostedCockpit(showing: roster)
        shell.warm()
        return cpuSeconds { shell.select(Self.other) }
    }

    /// The click pass now: the same shell, settled, so the switch is deferred.
    private static func deferred(_ roster: CockpitPresentation) async -> Double {
        SessionsRoomReadingCache.forget()
        let shell = HostedCockpit(showing: roster)
        await shell.settle()
        return cpuSeconds { shell.select(Self.other) }
    }

    private static let other = "two"

    private static func roster(scale: Int) -> CockpitPresentation {
        HostedCockpit.presentation(
            of: ["one", other],
            events: Array(repeating: TranscriptFixtures.longTranscript, count: scale)
                .flatMap(\.self),
        )
    }
}
