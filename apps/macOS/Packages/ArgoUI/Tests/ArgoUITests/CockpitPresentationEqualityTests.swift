import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the stamp stands for, and what it does not (ADR-0028 Rule 1): two streams carrying one
/// stamp compare equal, and every fact ABOVE the stream — the Session's id, its status, the Turn it
/// lost — is still compared by value.
///
/// Every Session here is built by hand: the claim is about the synthesised equality, not about
/// anything a transcript did. A stream that MOVED is `CockpitPresentationStampTests`.
@Suite("Cockpit presentation equality")
struct CockpitPresentationEqualityTests {
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
}
