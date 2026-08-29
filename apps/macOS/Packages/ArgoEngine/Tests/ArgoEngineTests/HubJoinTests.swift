@testable import ArgoEngine
import Foundation
import Testing

/// What a Subagent's bytes reach, and what they must leave alone. A child's tail writes
/// continuously while three agents run, so what it costs and what it disturbs are the same
/// question (ADR-0028 Rule 1).
@Suite("Hub join")
struct HubJoinTests {
    private let agentID = "agent-1"
    /// The one record a child's batch carries here — what it says is not the subject.
    private static let said = TranscriptEvent.message(markdown: "the child said")

    /// A read arriving while the sweep is admitting a transcript still lands: the roster is held
    /// back from being REBUILT, not from being told what one of its Sessions is now reading.
    @Test
    func `a Subagent's reading reaches its Session while a sweep is in flight`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([Self.said], ofSubagent: agentID, to: "session")

        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
    }

    /// The gate the whole-set assignment was there for: a transcript the sweep has admitted but
    /// nothing has read yet must not appear on the roster under the reader.
    @Test
    func `a Subagent's reading publishes no transcript the sweep has not read`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([Self.said], ofSubagent: agentID, to: "swept")
        join.apply([Self.said], ofSubagent: agentID, to: "session")

        #expect(join.sessions.map(\.id) == ["session"])
    }

    /// A fan-out's file sits beside the link that ran it, so a read against a CONTINUATION belongs
    /// on the Session that continuation was merged into rather than on a row of its own.
    @Test
    func `a Subagent's reading beside a continuation reaches the Session it continues`() {
        var join = HubJoin()
        join.add(hubTestObservation(id: "root", events: []))
        join.add(hubTestObservation(id: "child", events: []))
        join.apply([.recordIdentity(uuid: "root-leaf")], to: "root")
        join.apply([.headLeaf(uuid: "root-leaf")], to: "child")

        join.apply([Self.said], ofSubagent: agentID, to: "child")

        #expect(join.sessions.map(\.id) == ["root"])
        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
    }

    /// The claim the whole change is for, in the one shape that survives a change of machine
    /// (ADR-0028 Rule 3): a child's batch costs what it costs, whatever else is on the roster.
    /// Rebuilding every Session and the chain graph for it would make this ratio the size of the
    /// working set: 200 batches cost 0.13 ms over 200 transcripts and 0.14 ms over four, where
    /// rebuilding cost 261 ms against 5.8 ms (debug build, Apple silicon laptop).
    @Test
    func `a Subagent's reading costs no more on a large roster than on a small one`() {
        let small = Self.leastCostOfReading(across: 4)

        let large = Self.leastCostOfReading(across: 200)

        #expect(large < small * 4)
    }

    /// What 200 Subagent batches cost against a settled roster of `count` transcripts. CPU noise
    /// is one-sided, so the least of three trials is the honest reading (ADR-0028 Rule 7).
    private static func leastCostOfReading(across count: Int) -> Duration {
        var join = HubJoin()
        for index in 0 ..< count {
            join.add(hubTestObservation(id: "session-\(index)", events: []))
            join.apply([.title("Session \(index)")], to: "session-\(index)")
        }
        let read = [said]
        return (0 ..< 3).map { _ in
            let started = ContinuousClock.now
            for batch in 0 ..< 200 {
                join.apply(read, ofSubagent: "agent-\(batch % 4)", to: "session-0")
            }
            return ContinuousClock.now - started
        }
        .min() ?? .zero
    }

    /// One transcript, read and published — the state every case above starts from.
    private func settledJoin() -> HubJoin {
        var join = HubJoin()
        join.add(hubTestObservation(id: "session", events: []))
        join.apply([.title("Reading")], to: "session")
        return join
    }
}
