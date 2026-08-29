@testable import ArgoEngine
import Foundation
import Testing

/// What a Subagent's bytes reach, and what they must leave alone. A child's tail writes
/// continuously while three agents run, so what it costs and what it disturbs are the same
/// question (ADR-0028 Rule 1).
@Suite("Hub join")
struct HubJoinTests {
    private let agentID = "agent-1"
    /// The records a child's batch carries here — what they say is not the subject.
    private static let said = TranscriptEvent.message(markdown: "the child said")
    private static let saidAgain = TranscriptEvent.message(markdown: "the child said again")

    /// The reading the rail draws, which is what all of this is for.
    @Test
    func `a Subagent's reading reaches its Session`() {
        var join = settledJoin()

        join.apply([Self.said], ofSubagent: agentID, to: "session")

        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
    }

    /// A transcript admitted mid-sweep can duplicate a uuid or join a chain, and neither is known
    /// until the file has been read — so what the roster last folded is older than the set, and a
    /// child's bytes wait for the fold that can place them rather than being written on a guess.
    @Test
    func `a Subagent's reading arrives with the rebuild while a sweep is in flight`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([Self.said], ofSubagent: agentID, to: "session")

        #expect(join.sessions.first?.subagentEvents[agentID] == nil)
        join.apply([.title("Swept")], to: "swept")
        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
    }

    /// Not on the row it would have joined, and not on any other: a batch against a transcript
    /// nothing has read has no row to be right about.
    @Test
    func `a Subagent's reading against an unread transcript reaches no row`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([Self.said], ofSubagent: agentID, to: "swept")

        let readings = join.sessions.flatMap(\.subagentEvents.keys)
        #expect(join.sessions.map(\.id) == ["session"])
        #expect(readings.isEmpty)
    }

    /// The rejection below is a fact about the SET, and the set moves without the roster being
    /// refolded: a file admitted a moment ago can duplicate the uuid of a row that was writable
    /// when the fold was taken. Written on that stale answer, the bytes are published and then
    /// dropped by the rebuild that finally sees both halves.
    @Test
    func `a Subagent's reading is not published against a transcript a later file duplicates`() {
        let origin = recordURL("origin", "moved")
        let worktree = recordURL("worktree", "moved")
        var join = HubJoin()
        join.add(hubTestObservation(at: origin, events: []))
        join.apply([.prompt(text: "Origin", images: [], atMs: 1)], to: origin.path)

        join.add(hubTestObservation(at: worktree, events: []))
        join.apply([Self.said], ofSubagent: agentID, to: origin.path)

        #expect(join.sessions.first?.subagentEvents[agentID] == nil)
        join.apply([.prompt(text: "Live", images: [], atMs: 2)], to: worktree.path)
        #expect(join.sessions.first?.subagentEvents[agentID] == nil)
    }

    /// And the rejection lifts when the set moves back: the file that duplicated the uuid going
    /// away leaves one path carrying it, which is a row a batch can be written into again.
    @Test
    func `a Subagent's reading is written in place again once the file duplicating it is gone`() {
        let origin = recordURL("origin", "moved")
        let worktree = recordURL("worktree", "moved")
        var join = HubJoin()
        join.add(hubTestObservation(at: origin, events: []))
        join.add(hubTestObservation(at: worktree, events: []))
        join.apply([.title("Frozen")], to: origin.path)
        join.apply([.prompt(text: "Live", images: [], atMs: 2)], to: worktree.path)

        join.remove(transcriptID: origin.path)
        join.apply([Self.said], ofSubagent: agentID, to: worktree.path)

        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
    }

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

    /// A fan-out's file sits beside the link that ran it, so a read against a CONTINUATION belongs
    /// on the Session that continuation was merged into rather than on a row of its own.
    @Test
    func `a Subagent's reading beside a continuation reaches the Session it continues`() {
        var join = chainedJoin()

        join.apply([Self.said], ofSubagent: agentID, to: "child")

        #expect(join.sessions.map(\.id) == ["root"])
        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
    }

    /// A chain merges its links root-first, so a batch against an EARLIER link belongs in front of
    /// what a later one already published — which is not where appending puts it. Those bytes wait
    /// for the rebuild instead, rather than being published in an order a rebuild then undoes.
    @Test
    func `a Subagent's reading beside an earlier link waits for the rebuild that can order it`() {
        var join = chainedJoin()
        join.apply([Self.said], ofSubagent: agentID, to: "child")

        join.apply([Self.saidAgain], ofSubagent: agentID, to: "root")

        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.said])
        join.apply([.title("Read again")], to: "root")
        #expect(join.sessions.first?.subagentEvents[agentID] == [Self.saidAgain, Self.said])
    }

    /// Two paths carrying one uuid are one file the CLI MOVED, and the path it left holds a frozen
    /// prefix that no roster draws. A child read beside THAT half is DROPPED rather than delayed —
    /// the rebuild discards that half's whole reading, here and on main alike — so publishing it
    /// in place would put bytes on a row that then loses them.
    @Test
    func `a Subagent's reading beside the frozen half of a moved transcript publishes nothing`() {
        let frozen = recordURL("origin", "moved")
        let live = recordURL("worktree", "moved")
        var join = HubJoin()
        join.add(hubTestObservation(at: frozen, events: []))
        join.add(hubTestObservation(at: live, events: []))
        join.apply([.title("Frozen")], to: frozen.path)
        join.apply([.prompt(text: "Live", images: [], atMs: 2)], to: live.path)

        join.apply([Self.said], ofSubagent: agentID, to: frozen.path)

        #expect(join.sessions.first?.subagentEvents[agentID] == nil)
        join.apply([.title("Read again")], to: live.path)
        #expect(join.sessions.first?.subagentEvents[agentID] == nil)
    }

    /// The claim the whole change is for, in the one shape that survives a change of machine
    /// (ADR-0028 Rule 3): a child's batch costs what it costs, whatever else is on the roster.
    /// Rebuilding every Session and the chain graph for it would make this ratio the size of the
    /// working set — 200 batches cost 0.12 ms of CPU over 200 transcripts and 0.13 ms over four,
    /// where rebuilding cost 281 ms against 6.0 ms (debug build, Apple silicon laptop). The
    /// figures live here until #953 gives the recorded ones one file.
    @Test
    func `a Subagent's reading does not cost more as the roster grows`() {
        let small = Self.leastCostOfReading(across: 4)

        let large = Self.leastCostOfReading(across: 200)

        #expect(large < small * 13 / 10)
    }

    /// What 200 Subagent batches cost against a settled roster of `count` transcripts, in CPU time
    /// rather than wall clock. Noise is one-sided, so the least of three trials is the honest
    /// reading (ADR-0028 Rule 7).
    private static func leastCostOfReading(across count: Int) -> Duration {
        var join = HubJoin()
        for index in 0 ..< count {
            join.add(hubTestObservation(id: "session-\(index)", events: []))
            join.apply([.title("Session \(index)")], to: "session-\(index)")
        }
        let read = [said]
        return (0 ..< 3).map { _ in
            let started = threadCPUTime()
            for batch in 0 ..< 200 {
                join.apply(read, ofSubagent: "agent-\(batch % 4)", to: "session-0")
            }
            return threadCPUTime() - started
        }
        .min() ?? .zero
    }

    /// The CPU this thread has burned. Wall clock would measure whatever else the machine is
    /// doing, which on a laptop running the rest of this suite is most of it.
    private static func threadCPUTime() -> Duration {
        var spent = timespec()
        clock_gettime(CLOCK_THREAD_CPUTIME_ID, &spent)
        return .seconds(spent.tv_sec) + .nanoseconds(spent.tv_nsec)
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
