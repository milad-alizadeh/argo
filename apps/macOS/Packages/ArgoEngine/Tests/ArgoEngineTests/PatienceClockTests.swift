@testable import ArgoEngine
import Testing

/// The clock a raise arms, and every way it has to be disarmed: it runs out and the request is
/// handed back refused, and a request that leaves the pile any earlier — answered by name, answered
/// by predicate, dropped with its peer, or taken with its whole key — takes its clock with it.
///
/// The pile itself is `PatienceTableTests`. Every case here runs on `.immediate` patience, so a
/// clock still armed fires on the next hop rather than in an hour.
@Suite("Patience clock")
@MainActor
struct PatienceClockTests {
    /// The gate's own clock: it runs out, the table lifts the request and hands it back for the
    /// gate to refuse in whatever words its transport takes.
    @Test
    func `a request nobody answers is lifted and handed back as refused`() async {
        let watched = WatchedTable(patience: .immediate)
        watched.raise()

        _ = await settle { !watched.refused.isEmpty }

        #expect(watched.refused == ["blocked-1"])
        #expect(watched.waiting.isEmpty)
        // The refusal is handed over BEFORE the publish, so the gate's own reading of it lands in
        // the same breath as the pile that no longer holds it.
        #expect(watched.published.last == [])
    }

    /// The invariant the three gates each asserted by hand: an answered request's timer must not
    /// still fire. The clock here is `immediate`, so it would go off on the very next hop.
    @Test
    func `an answered request's clock never fires behind the answer`() async {
        let watched = WatchedTable(patience: .immediate)
        watched.raise()

        _ = watched.table.answer("blocked-1", for: "claim") { _ in }
        try? await Task.sleep(for: .milliseconds(50))

        #expect(watched.refused.isEmpty)
    }

    @Test
    func `a request covered by a predicate answer never expires behind it`() async {
        let watched = WatchedTable(patience: .immediate)
        watched.raise()

        _ = watched.table.answerAll(matching: { _ in true }, for: "claim", with: { _ in })
        try? await Task.sleep(for: .milliseconds(50))

        #expect(watched.refused.isEmpty)
    }

    @Test
    func `a request whose peer went never expires behind it`() async {
        let watched = WatchedTable(patience: .immediate)
        watched.raise(peer: 3)

        watched.table.peerGone(3, for: "claim")
        try? await Task.sleep(for: .milliseconds(50))

        #expect(watched.refused.isEmpty)
    }

    /// The scope is over: everything under it goes in silence, and the clocks go with it — a
    /// day-long `Task` sleeping against a torn-down gate is a leak rather than a bug.
    @Test
    func `a withdrawn key takes its requests and their clocks`() async {
        let watched = WatchedTable(patience: .immediate)
        watched.raise()
        watched.raise()

        watched.table.withdraw("claim")
        try? await Task.sleep(for: .milliseconds(50))

        #expect(watched.waiting.isEmpty)
        #expect(watched.published.last == [])
        #expect(watched.refused.isEmpty)
    }
}
