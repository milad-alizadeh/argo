@testable import ArgoEngine
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

    /// A batch of nothing, against a transcript that has already been read, returns before the fold
    /// — so this states what the roster still holds while ANOTHER transcript has writes held on it
    /// (`HubRoster.holdWrites`). The empty batch used to refold it as a side effect (#858).
    @Test
    func `an empty batch on a settled transcript leaves the rest of the roster standing`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "swept", events: []))

        join.apply([], to: "session")
        join.apply([.title("Swept")], to: "swept")

        #expect(join.sessions.map(\.id).sorted() == ["session", "swept"])
        #expect(join.sessions.compactMap(\.title).sorted() == ["Reading", "Swept"])
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

    /// Selecting a Session reads its file again, whole. A long file takes seconds, and for those
    /// seconds the row on screen is the STALE reading, never an absent one: a row that vanishes
    /// under the click and comes back reads as data loss (#1134).
    ///
    /// The other transcript's batch is the part that bites: on an active machine some Session is
    /// always writing, and its batch refolds the roster while the reread is still unsettled.
    @Test
    func `a reread keeps the row published, stale, until the new reading settles`() {
        var join = settledJoin()
        join.add(hubTestObservation(id: "other", events: []))
        join.apply([.title("Other")], to: "other")

        join.reread(hubTestObservation(id: "session", events: []))
        join.apply([.message(markdown: "still writing")], to: "other")

        #expect(join.sessions.map(\.id).sorted() == ["other", "session"])
        #expect(join.sessions.compactMap(\.title).sorted() == ["Other", "Reading"])
    }

    /// And the reading it replaces is dropped the moment the new one lands, so nothing the first
    /// reading saw is counted twice.
    @Test
    func `the reading a reread replaces is dropped when the new one lands`() {
        var join = settledJoin()
        join.apply([.message(markdown: "first")], to: "session")

        join.reread(hubTestObservation(id: "session", events: []))
        join.apply(
            [.title("Whole"), .message(markdown: "first"), .message(markdown: "second")],
            to: "session",
        )

        #expect(join.sessions.map(\.title) == ["Whole"])
        #expect(join.sessions.first?.events.filter { $0 == .message(markdown: "first") }.count == 1)
    }

    /// A row that has stood on the roster stands through the next sweep too, whatever its leaf
    /// says. A Session resumed from a file outside the window has a leaf nobody in the set owns,
    /// and holding it back on every sweep that admits a file — every new Session on the machine —
    /// is the row that vanishes mid-scroll and comes back (#1134).
    @Test
    func `a row already on the roster stands while a sweep admits an unread transcript`() {
        var join = settledJoin()
        join.apply([.headLeaf(uuid: "outside-the-window")], to: "session")
        join.add(hubTestObservation(id: "other", events: []))
        join.apply([.title("Other")], to: "other")
        #expect(join.sessions.map(\.id).sorted() == ["other", "session"])

        join.add(hubTestObservation(id: "swept", events: []))
        join.apply([.message(markdown: "still writing")], to: "other")

        #expect(join.sessions.map(\.id).sorted() == ["other", "session"])
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
