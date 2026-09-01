import ArgoEngine
@testable import ArgoUI
import Testing

/// What one `CockpitPresentation` comparison COSTS (ADR-0028 Rule 3 and Rule 7).
///
/// SwiftUI diffs the presentation field by field, so this runs once per Session per body pass, and
/// the presentation carries every Session's whole decoded event stream. The identical-buffer fast
/// path in `Array.==` covered the warm case and nothing else: a roster refold reallocates the
/// stream of every chained Session, and the pass after one deep-compared all of it.
///
/// RATIOS, never durations: each case measures the same comparison over a short transcript and a
/// long one and asserts the cost did not follow the length. A comparison that walks the stream
/// fails on the ratio whatever machine it runs on, which is what Rule 3 asks of a per-body path.
///
/// The ratio's two halves are the same KIND of work over the same memory profile — one comparison
/// of one presentation, at two transcript lengths — which is what Rule 3's two-fixture shape is for
/// and what makes the quotient a fact about the code (`cpuSeconds`, `MinimapWalkCostTests`). What
/// it lacked was RESOLUTION. A pass costs about 1.8 µs, and the block under the clock was 100 of
/// them: 185 µs, inside which one frequency step or one stall lands whole. Measured over three
/// readings each: at 100 passes the ratio read 0.975 to 0.998, and it failed a 1.3 bound once at
/// load average 130; at 5 000 passes — 9 ms a block — it reads 0.997 to 1.002. The bound is
/// unchanged and the instrument is 48x coarser than the thing it was asked to see, which is the
/// only honest way to fix a budget that fails at the clock's floor.
///
/// Recorded on an Apple silicon laptop, debug, `swift test`, over 4 Sessions of 5 824 events each:
/// an equal comparison whose buffers were reallocated cost 5.48 ms before this and 3.9 µs after (1
/// 400x), and the ratio it is gated by fell from about 19 to 1.0. A pass now reads 1.8 µs, the
/// difference being that a pass is timed inside a 5 000-pass block rather than a 100-pass one.
@Suite("Cockpit presentation cost", .serialized)
@MainActor
struct CockpitPresentationCostTests {
    /// The case the fix is for: equal content the engine rebuilt, so no two streams share a buffer.
    @Test
    func `an equal comparison does not scale with the transcript`() {
        let short = Self.pair(events: Self.short)
        let long = Self.pair(events: Self.long)

        let small = Self.perPass { _ = short.0 == short.1 }
        let large = Self.perPass { _ = long.0 == long.1 }

        #expect(short.0 == short.1)
        #expect(large < small * Self.flat)
    }

    /// The other half, which Rule 7 forbids letting the warm case stand in for: a Session whose
    /// stream GREW must be found changed, and finding that out may not walk either stream either.
    @Test
    func `a changed comparison does not scale with the transcript`() {
        let short = Self.grown(events: Self.short)
        let long = Self.grown(events: Self.long)

        let small = Self.perPass { _ = short.0 == short.1 }
        let large = Self.perPass { _ = long.0 == long.1 }

        #expect(short.0 != short.1)
        #expect(long.0 != long.1)
        #expect(large < small * Self.flat)
    }

    /// Rule 3's own number, spent on a path that must now be flat in the transcript's length. Not
    /// 1.0: the two fixtures allocate differently and the clock has a floor.
    private static let flat = 1.3
    /// Enough repeats that the block under the clock is MILLISECONDS of work rather than
    /// microseconds — see the suite comment for why that is what made this sound. 5 000 of them is
    /// about 9 ms a block.
    private static let passes = 5000

    private static func perPass(_ work: () -> Void) -> Double {
        leastCPUSeconds(trials: 20) { for _ in 0 ..< passes {
            work()
        } } / Double(passes)
    }

    private static let short = TranscriptFixtures.longTranscript
    private static let long = Array(repeating: TranscriptFixtures.longTranscript, count: 8)
        .flatMap(\.self)

    /// Two presentations of equal content whose streams share no buffer — what a roster refold
    /// hands the shell, and the only case in which the array fast path was ever missed.
    private static func pair(events: [TranscriptEvent])
        -> (CockpitPresentation, CockpitPresentation) {
        (presentation(events: events), presentation(events: reallocated(events)))
    }

    /// A batch on the LAST Session of a roster the engine just rebuilt: three Sessions of equal
    /// content in fresh buffers, and then the one that grew. The three in front are the point — a
    /// comparison that walks them pays for the whole roster before reaching the change.
    private static func grown(events: [TranscriptEvent])
        -> (CockpitPresentation, CockpitPresentation) {
        var later = Array(repeating: reallocated(events), count: 4)
        later[3] = events + [.message(markdown: "later")]
        return (presentation(events: events), presentation(streams: later))
    }

    /// The same events in a buffer of their own. An append forces the copy-on-write the shared
    /// buffer would otherwise hand back.
    private static func reallocated(_ events: [TranscriptEvent]) -> [TranscriptEvent] {
        var copy = events
        copy.append(.message(markdown: "dropped"))
        copy.removeLast()
        return copy
    }

    /// Four Sessions, which is a working roster: the whole cost is per Session, and one of them
    /// would let a walk hide behind the three that share their buffers.
    private static func presentation(events: [TranscriptEvent]) -> CockpitPresentation {
        presentation(streams: Array(repeating: events, count: 4))
    }

    private static func presentation(streams: [[TranscriptEvent]]) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: zip(["one", "two", "three", "four"], streams).map { id, events in
                CockpitPresentation.Session(
                    id: id,
                    title: id,
                    access: .managed,
                    status: .idle,
                    transcript: .init(events: events),
                )
            },
            checkout: .unavailable,
            connection: .idle,
        )
    }
}
