@testable import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the cockpit's own equality answers about a Session whose transcript moved (ADR-0028 Rule
/// 1).
///
/// `CockpitPresentation.Session` compares its whole decoded stream by a stamp rather than by
/// walking it, and a stamp that stands still while the stream moves is a stale cockpit rather than
/// a slow one. So each case here drives the ENGINE — one batch, one Subagent read, one resume — and
/// asserts the projection reports the change, which is what SwiftUI reads.
///
/// Every other fact a Session renders is compared by value, by the synthesised equality this
/// deliberately keeps: the stamp stands for the two streams and for nothing else.
@Suite("Cockpit presentation stamp")
@MainActor
struct CockpitPresentationStampTests {
    /// The tail's own path: one event, whatever kind. Projected through
    /// `Session(observed:readings:)`, which is the projection the shell actually reads.
    @Test
    func `an event applied is a fresh Session`() {
        var session = Self.observed()
        let opening = Self.projected(session)

        session.apply(.message(markdown: "second"))

        #expect(Self.projected(session) != opening)
    }

    /// A kind that folds to no fact at all still draws a row, so it still has to be a fresh
    /// Session.
    @Test
    func `an event that changes no folded fact is a fresh Session too`() {
        var session = Self.observed()
        let opening = Self.projected(session)

        session.apply(.unreadableLine(raw: "{"))

        #expect(Self.projected(session) != opening)
    }

    /// The later half of a resume chain, which is the input a write count alone would miss.
    @Test
    func `a resume whose continuation grew is a fresh Session`() {
        var continuation = Self.observed(id: "second")
        continuation.apply(.message(markdown: "later"))
        var short = Self.observed()
        short.mergeContinuation(continuation)
        let opening = Self.projected(short)

        continuation.apply(.message(markdown: "later still"))
        var grown = Self.observed()
        grown.mergeContinuation(continuation)

        #expect(Self.projected(grown) != opening)
    }

    /// End to end, through the Hub the shell reads: a second batch on a live transcript is a fresh
    /// presentation. The cases above hold the projection; this one holds the whole seam.
    @Test
    func `a second batch on a live transcript is a fresh presentation`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        let tail = Self.Tail()
        await hub.startObserving(TranscriptObservation(
            id: "root",
            sourceURL: URL(fileURLWithPath: "/tmp/root.jsonl"),
            events: tail.events,
        ))
        tail.yield([.message(markdown: "first")])
        await Self.settle(hub) { $0.events.count == 1 }
        let opening = Self.projection(hub)

        tail.yield([.message(markdown: "second")])
        await Self.settle(hub) { $0.events.count == 2 }

        #expect(Self.projection(hub) != opening)
    }

    /// The inverse, and the whole point: a pass in which nothing was written compares EQUAL, so the
    /// cockpit redraws nothing.
    @Test
    func `a pass with nothing written is the same presentation`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        let tail = Self.Tail()
        await hub.startObserving(TranscriptObservation(
            id: "root",
            sourceURL: URL(fileURLWithPath: "/tmp/root.jsonl"),
            events: tail.events,
        ))
        tail.yield(TranscriptFixtures.longTranscript)
        await Self.settle(hub) { !$0.events.isEmpty }

        #expect(Self.projection(hub) == Self.projection(hub))
    }

    /// That the comparison does not WALK the stream, proved by construction rather than by a clock:
    /// two streams carrying the same stamp and different events compare equal. A walk could not
    /// answer that, so this is the strongest available evidence there is no walk left.
    ///
    /// It is also the shape of the one unsoundness the design allows — a stream assembled OUTSIDE
    /// the engine and then rewritten at the same length. Fixtures are constants; nothing live
    /// reaches this, because every live stream carries the engine's own write count.
    @Test
    func `equality is the stamp and not the events`() {
        let stamp = TranscriptStamp(events: [.message(markdown: "one")])
        let said = Self.session(events: [.message(markdown: "said")], stamp: stamp)
        let other = Self.session(events: [.message(markdown: "different")], stamp: stamp)

        #expect(said == other)
        #expect(said.events != other.events)
    }

    /// And the guard that makes that sound where it matters: two Sessions can share a stamp, and
    /// the id above the transcript is what stops them ever comparing equal because of it.
    @Test
    func `two Sessions sharing a stamp are still two Sessions`() {
        let events: [TranscriptEvent] = [.message(markdown: "said")]

        let one = Self.session(id: "one", events: events)
        let two = Self.session(id: "two", events: events)

        #expect(one != two)
    }

    /// A Session's own facts are compared by VALUE, and the stamp does not stand for any of them —
    /// the case that would break if the transcript's cheap equality ever spread to the Session.
    @Test
    func `a fact outside the transcript is still compared by value`() {
        let events: [TranscriptEvent] = [.message(markdown: "said")]
        let idle = Self.session(events: events)

        let running = CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: .managed,
            status: .running,
            transcript: .init(events: events),
        )

        #expect(idle != running)
    }

    /// The one transcript fact the stamp does NOT stand for, which is why it sits above the streams
    /// rather than inside them (#682).
    @Test
    func `a lost Turn is compared by value`() {
        let events: [TranscriptEvent] = [.message(markdown: "said")]

        let sent = Self.session(events: events)
        let lost = CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: .managed,
            status: .idle,
            transcript: .init(events: events, lostTurn: "never heard"),
        )

        #expect(sent != lost)
    }

    private static func session(
        id: String = "one",
        events: [TranscriptEvent],
        stamp: TranscriptStamp? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: id,
            access: .managed,
            status: .idle,
            transcript: .init(events: events, transcriptStamp: stamp),
        )
    }

    private static func observed(id: String = "root") -> HubSession {
        var session = HubSession(observation: TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: AsyncStream { $0.finish() },
        ))
        session.apply(.message(markdown: "first"))
        return session
    }

    private static func projected(_ session: HubSession) -> CockpitPresentation.Session {
        CockpitPresentation.Session(observed: session, readings: .none)
    }

    /// A tail the test itself feeds, so a transcript can take a SECOND batch — the shape a live
    /// reading has and a one-shot fixture stream does not.
    private final class Tail {
        let events: AsyncStream<[TranscriptEvent]>
        private let continuation: AsyncStream<[TranscriptEvent]>.Continuation

        init() {
            (self.events, self.continuation) = AsyncStream.makeStream()
        }

        func yield(_ batch: [TranscriptEvent]) {
            continuation.yield(batch)
        }
    }

    /// Yield until the roster reports what the batch just written should have made true.
    private static func settle(
        _ hub: Hub,
        until applied: (CockpitPresentation.Session) -> Bool,
    ) async {
        for _ in 0 ..< 200 {
            if let session = projection(hub).sessions.first, applied(session) {
                return
            }
            await Task.yield()
        }
    }

    private static func projection(_ hub: Hub) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            hub: hub,
            readings: .none,
        )
    }
}
