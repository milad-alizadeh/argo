import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What one `CockpitPresentation` comparison COSTS, said in the events it read (ADR-0028 Rule 8).
///
/// SwiftUI diffs the presentation field by field, so this runs once per Session per body pass, and
/// the presentation carries every Session's whole decoded event stream. The identical-buffer fast
/// path in `Array.==` covered the warm case and nothing else: a roster refold reallocates the
/// stream of every chained Session, and the pass after one deep-compared all of it — 5.48 ms for
/// four Sessions of 5 824 events, on a pass in which nothing had changed (#1005).
///
/// A COUNT, and never the seconds it takes: the stream keeps its events in `HeldEvents`, whose
/// accessor is the only way to them and tallies every ask, so a comparison that walks them has to
/// ask and one answered by the stamp asks for nothing. Zero at a short transcript and zero at an
/// eightfold one — the claim the two fixtures carry is that the count does not follow the length,
/// and it is exact rather than bounded.
///
/// **This replaces a quotient of two thread-CPU readings**, which is the shape Rule 8 forbids
/// where a count exists: its two arms were the same comparison over one and eight times the
/// resident working set, a difference `CLOCK_THREAD_CPUTIME_ID` charges to the larger arm in every
/// trial, so no least-of-N could take it out. It read 1.3045 against its own `1.3` on the `macos`
/// job on a branch touching nothing it measures, with `main` green on the same code (#1068). The
/// readings it was written against sit beside `PerfBudgets.presentationCompareReads` as figures
/// gated by nothing.
///
/// **Narrower than the quotient it replaces, and ADR-0028's amendment says so.** The old assertion
/// timed the WHOLE presentation comparison, so every other field of every Session was held against
/// growing with the transcript as a side effect of it; this one holds the stream, which is the
/// only field that carries the transcript and the only one the doc comment above ever named. And
/// it is this type's own tally: a transcript-sized field added to `Transcript` BESIDE the stream,
/// where equality is synthesised, would be deep-compared without ever asking the stream for
/// anything — which `Stream`'s own doc comment now says is not where such a fact goes. That a
/// count only holds the pass reporting it is the limit every count in this suite carries.
@Suite("Cockpit presentation cost", .serialized)
@MainActor
struct CockpitPresentationCostTests {
    /// The case the fix is for: equal content the engine rebuilt, so no two streams share a buffer.
    @Test
    func `an equal comparison reads none of the transcript`() {
        let short = Self.pair(events: Self.short)
        let long = Self.pair(events: Self.long)

        #expect(short.0 == short.1)
        #expect(long.0 == long.1)

        #expect(Self.reads(short) == PerfBudgets.presentationCompareReads)
        #expect(Self.reads(long) == PerfBudgets.presentationCompareReads)
        Self.expectComparable(Self.pair(events: Self.short))
        Self.expectComparable(Self.pair(events: Self.long))
    }

    /// The other half, which Rule 7 forbids letting the warm case stand in for: a Session whose
    /// stream GREW must be found changed, and finding that out may not walk either stream either.
    @Test
    func `a changed comparison reads none of the transcript`() {
        let short = Self.grown(events: Self.short)
        let long = Self.grown(events: Self.long)

        #expect(short.0 != short.1)
        #expect(long.0 != long.1)

        #expect(Self.reads(short) == PerfBudgets.presentationCompareReads)
        #expect(Self.reads(long) == PerfBudgets.presentationCompareReads)
        Self.expectComparable(Self.grown(events: Self.short))
        Self.expectComparable(Self.grown(events: Self.long))
        // The three Sessions in front of the one that grew are equal, which is what makes this the
        // expensive case: a comparison that walks pays for the whole roster before it reaches the
        // change. A fixture that differed at the first Session would never reach them.
        #expect(short.0.sessions[0] == short.1.sessions[0])
        #expect(short.0.sessions[3] != short.1.sessions[3])
    }

    /// Every stream in both presentations, summed: a comparison walking any ONE of them is a read.
    private static func reads(_ pair: (CockpitPresentation, CockpitPresentation)) -> Int {
        streams(pair).map(\.reads.count).reduce(0, +)
    }

    /// What the count above would be worthless without, so it is asserted rather than assumed —
    /// over a pair of its OWN, because reading a stream is what moves the tally the cases gate.
    ///
    /// The two sides of what the builder makes share no buffer, because `Array.==` answers an
    /// identical buffer without looking at an element — so a walking comparison over shared
    /// buffers would read zero too. And the counter is LIVE: the same tally that reads zero above
    /// moves the moment a stream is asked for, which the reads here are. The fixture is long
    /// enough for either to mean anything.
    private static func expectComparable(_ pair: (CockpitPresentation, CockpitPresentation)) {
        let looked = zip(pair.0.sessions, pair.1.sessions).map { one, other in
            (
                mine: buffer(of: one.events),
                theirs: buffer(of: other.events),
                events: one.events.count,
            )
        }
        #expect(looked.allSatisfy { $0.mine != $0.theirs })
        #expect(looked.allSatisfy { $0.mine != 0 && $0.theirs != 0 })
        #expect(looked.allSatisfy { $0.events >= events })
        // EVERY stream's tally, not the sum: one live counter beside seven dead ones would carry a
        // sum, and it is each of them the cases above read a zero off.
        #expect(streams(pair).allSatisfy { $0.reads.count >= 1 })
    }

    private static func streams(_ pair: (CockpitPresentation, CockpitPresentation))
        -> [CockpitPresentation.Session.Transcript.Stream] {
        [pair.0, pair.1].flatMap(\.sessions).map(\.transcript.stream)
    }

    /// The storage's address as a NUMBER, never as a pointer that outlives the access it came
    /// from: all this asks is whether two arrays are the same allocation.
    private static func buffer(of events: [TranscriptEvent]) -> UInt {
        events.withUnsafeBufferPointer { UInt(bitPattern: $0.baseAddress) }
    }

    /// How much longer the long fixture is than the short one — the two sizes Rule 3 asks a cost
    /// case to carry, and the reason a count of zero at both says the cost does not follow the
    /// length.
    private static let lengths = 8

    /// A floor under the short fixture, asserted because a gated zero is the same zero over an
    /// empty stream — the fixture is what carries the claim's size, and this is the drift #1065
    /// found. `longTranscript` runs to 728 events, and the long fixture to eight times that.
    private static let events = 500

    private static let short = TranscriptFixtures.longTranscript
    private static let long = Array(repeating: TranscriptFixtures.longTranscript, count: lengths)
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
            connection: .idle,
        )
    }
}
