@testable import ArgoEngine
import Foundation
import Testing

/// When the join publishes a roster and when it holds one back.
///
/// A Subagent's bytes no longer arrive here at all — they are published beside the roster since
/// #858 (`SubagentReadings`), and what they must leave alone is asserted there. What is left is the
/// parent's own batch and the sweep it can land in the middle of. The Session's own batch is
/// written in place under a stricter test than the Subagent's ever was (`HubRoster.soloRow`), and
/// `HubJoinIncrementalTests` is what holds that against a join that was not written incrementally.
@Suite("Hub join")
struct HubJoinTests {
    /// The gate the whole-set assignment was there for, exercised through the path that rebuilds:
    /// a Session's own batch republishes the roster, and mid-sweep that would draw a row for a
    /// transcript nothing has read — a roster rewriting itself under the reader.
    @Test
    func `a transcript the sweep has admitted stays off the roster until it has been read`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([.title("Read again")], to: "session")

        #expect(join.sessions.map(\.id) == ["session"])
    }

    /// And it joins the roster the moment its own file has said anything — including nothing, since
    /// a tail that ends without a backfill settles rather than holding the roster open for ever.
    @Test
    func `a transcript admitted mid-sweep joins the roster once it has been read`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([.title("Swept")], to: "swept")

        #expect(join.sessions.map(\.id).sorted() == ["session", "swept"])
    }

    /// A batch against a transcript the join was built without has no row to be right about.
    @Test
    func `a batch against an unknown transcript changes nothing`() {
        var join = settledJoin()

        join.apply([.title("Nobody")], to: "unknown")

        #expect(join.sessions.map(\.title) == ["Reading"])
    }

    /// A resume chain is one Session, and a batch against its later link belongs on the row the
    /// fold published for the chain rather than on a row of its own.
    @Test
    func `a batch against a continuation reaches the Session it continues`() {
        var join = chainedJoin()

        join.apply([.message(markdown: "the agent said")], to: "child")

        #expect(join.sessions.map(\.id) == ["root"])
        #expect(join.sessions.first?.events.contains(.message(markdown: "the agent said")) == true)
    }

    /// One transcript, read and published.
    private func settledJoin() -> HubJoin {
        var join = HubJoin()
        join.add(hubTestObservation(id: "session", events: []))
        join.apply([.title("Reading")], to: "session")
        return join
    }

    /// A resume chain, read and published as the one Session its two links are.
    private func chainedJoin() -> HubJoin {
        var join = HubJoin()
        join.add(hubTestObservation(id: "root", events: []))
        join.add(hubTestObservation(id: "child", events: []))
        join.apply([.recordIdentity(uuid: "root-leaf")], to: "root")
        join.apply([.headLeaf(uuid: "root-leaf")], to: "child")
        return join
    }
}
