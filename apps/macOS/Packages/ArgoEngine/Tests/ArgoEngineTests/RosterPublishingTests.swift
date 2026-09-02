@testable import ArgoEngine
import Foundation
import Testing

/// What the two remaining inputs of `Hub.rosterStamp` are allowed to publish (#858).
///
/// The scene root reads `hub.sessions`, so every observed counter that fold touches is a
/// dependency of the WHOLE cockpit: a bump republishes the roster and re-renders all 42 rows of it
/// whether or not a fact moved. `WorldReadingsPublishingTests` holds the poll half of that;
/// `SubagentReadingsTests` holds the child's-bytes half. These are the other two, and both were
/// unconditional — the claim ledger bumped `revision` on every write, and the join bumped
/// `joinRevision` on every mutation, no-ops included.
///
/// Every case reads the roster through the same door the cockpit does and asserts whether that read
/// was invalidated, never whether a rule returned true. Each pair is a claim and its control: a
/// wire that never fires would satisfy the negative case by observing nothing.
@Suite("Roster publishing")
@MainActor
struct RosterPublishingTests {
    /// The companion channel is what makes this the shape ADR-0028 Rule 1 forbids rather than a
    /// curiosity: every peer event on one Session's plugin socket republishes `live` for that one
    /// claim, and an agent working sends many. One Session's traffic, the whole roster's cost.
    @Test
    func `a claim republished with the fact it already held publishes nothing`() async {
        let hub = await Self.reading()
        hub.claims.publish(companionLiveness: .live, for: Self.claim)
        let roster = Tripwire.watching { _ = hub.sessions }

        hub.claims.publish(companionLiveness: .live, for: Self.claim)

        #expect(!roster.fired)
    }

    @Test
    func `a claim whose fact moved is published`() async {
        let hub = await Self.reading()
        hub.claims.publish(companionLiveness: .live, for: Self.claim)
        let roster = Tripwire.watching { _ = hub.sessions }

        hub.claims.publish(companionLiveness: .dropped, for: Self.claim)

        #expect(roster.fired)
        #expect(hub.facts(forClaim: Self.claim).companionLiveness == .dropped)
    }

    /// The three-in-one write, which a gate read takes on every message its channel carries. It
    /// compares as one value, so a gate that found the same readings has to be as quiet as a
    /// single-field write that found the same fact.
    @Test
    func `a gate that found the same three readings publishes nothing`() async {
        let hub = await Self.reading()
        hub.claims.publish(GateReadings(), for: Self.claim)
        let roster = Tripwire.watching { _ = hub.sessions }

        hub.claims.publish(GateReadings(), for: Self.claim)

        #expect(!roster.fired)
    }

    /// A claim with nothing filed at all: the first write of an EMPTY fact is a publish about
    /// nothing, and `update` stored `nil` for it while bumping the counter anyway.
    @Test
    func `a claim that never held anything publishes nothing for an empty fact`() async {
        let hub = await Self.reading()
        let roster = Tripwire.watching { _ = hub.sessions }

        hub.claims.publish(waiting: [], for: Self.claim)

        #expect(!roster.fired)
    }

    /// The join's half. Every tail that ends settles its transcript, and one already settled
    /// settles to nothing — so a Session ageing out of the working set republished the roster for a
    /// write that changed no row.
    ///
    /// This pair reads `joinRevision` where the cases above read the wire, and the difference is
    /// the WAIT: both have to let a tail run, and the five-second liveness poll can land inside a
    /// wait on a loaded box. The counter is the same published fact — `Hub.rosterStamp` folds it,
    /// and the wire fires on the fold — with only the join's half of it in view.
    @Test
    func `a tail ending on a settled transcript publishes nothing`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let records = await Self.tailing(hub)
        let published = hub.watch.joinRevision

        records.finish()
        await hubTailEnded(hub, transcriptID: Self.transcriptID)

        #expect(hub.watch.joinRevision == published)
    }

    @Test
    func `a batch that grew a transcript is published`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let records = await Self.tailing(hub)
        let published = hub.watch.joinRevision

        records.yield([.message(markdown: "the agent said")])
        await hubSettle { hub.watch.joinRevision != published }

        #expect(hub.watch.joinRevision == published + 1)
        records.finish()
    }

    private static let claim = SessionOwnership.ClaimID(value: "roster-publishing")

    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-roster-publishing")

    private static let transcriptID = "root"

    /// One live transcript, read and settled — the state a tail is in when the two cases above
    /// start, and the one the roster publishes from.
    private static func tailing(_ hub: Hub) async
        -> AsyncStream<[TranscriptEvent]>.Continuation {
        let (observation, records) = hubLiveObservation(id: transcriptID)
        await hub.startObserving(observation)
        records.yield([.title("Reading")])
        await hubSettle { !hub.sessions.isEmpty }
        return records
    }

    /// A roster with one settled Session on it, so the fold the tripwire watches has something to
    /// answer and the counters it reads are all registered.
    private static func reading() async -> Hub {
        let hub = testHub(projectURL: projectURL)
        await hubObserveToEnd(hub, hubTestObservation(
            id: "root",
            events: [.title("Reading"), .message(markdown: "the agent said")],
        ))
        return hub
    }
}
