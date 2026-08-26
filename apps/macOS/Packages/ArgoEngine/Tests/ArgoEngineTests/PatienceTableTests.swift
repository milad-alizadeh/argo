@testable import ArgoEngine
import Foundation
import Testing

/// The discipline every gate that holds a blocked request shares (#750), asserted once, here, over
/// the table that now owns it: arm a clock, lift and cancel, refuse what nobody answered, and
/// republish the pile on every one of those.
///
/// The three gates above it keep only their own policy, and each suite asserts that instead —
/// the standing allow in `PermissionChannelTests`, the deliberate absence of a standing answer in
/// `AskChannelTests`, the patch join in `CodexApprovalTests`.
@Suite("Patience table")
@MainActor
struct PatienceTableTests {
    @Test
    func `a raised request goes on the pile under an id of the table's own minting`() throws {
        let watched = WatchedTable()

        let first = try #require(watched.raise())
        let second = try #require(watched.raise())

        #expect([first.patienceID, second.patienceID] == ["blocked-1", "blocked-2"])
        #expect(watched.waiting == ["blocked-1", "blocked-2"])
        // Published once per raise, and each time the whole pile: a caller reading one publish has
        // everything that is waiting, not a delta it has to fold.
        #expect(watched.published == [["blocked-1"], ["blocked-1", "blocked-2"]])
    }

    /// A line the gate could not read as its own kind of request puts nothing on the pile — and
    /// nothing is published for it either, because nothing changed.
    @Test
    func `a request the gate cannot build is not raised`() {
        let watched = WatchedTable()

        let raised = watched.table.raise(for: "claim") { _ in nil }

        #expect(raised == nil)
        #expect(watched.waiting.isEmpty)
        #expect(watched.published.isEmpty)
    }

    /// By id and never by position: a Session can have several requests waiting, and one replaced
    /// between the reading and the click would send the answer to the request underneath.
    @Test
    func `an answer lifts the named request and leaves its neighbour waiting`() {
        let watched = WatchedTable()
        watched.raise()
        watched.raise()
        var answered: [String] = []

        let took = watched.table.answer("blocked-1", for: "claim") {
            answered.append($0.patienceID)
        }

        #expect(took)
        #expect(answered == ["blocked-1"])
        #expect(watched.waiting == ["blocked-2"])
        #expect(watched.published.last == ["blocked-2"])
    }

    /// What a gate's standing-allow policy reads before it grants: the request by name, still on
    /// the
    /// pile, so the grant can cover it along with its siblings.
    @Test
    func `a waiting request can be read by name without being lifted`() {
        let watched = WatchedTable()
        watched.raise()
        let publishes = watched.published.count

        #expect(watched.table.waiting("blocked-1", for: "claim")?.toolName == "Bash")
        #expect(watched.table.waiting("blocked-9", for: "claim") == nil)

        // A read is not a change: reading the pile must not republish it.
        #expect(watched.waiting == ["blocked-1"])
        #expect(watched.published.count == publishes)
    }

    /// A scope that held nothing is not news — `ClaimLedger.withdraw` says the same of a claim with
    /// nothing filed, and a publish here would file a record for a teardown that cleared nothing.
    @Test
    func `withdrawing a key that held nothing publishes nothing`() {
        let watched = WatchedTable()

        watched.table.withdraw("claim")

        #expect(watched.published.isEmpty)
    }

    /// An answer that raced its own end is reported rather than swallowed, and reaches no other
    /// request in passing.
    @Test
    func `an answer to a request that is no longer waiting is refused`() {
        let watched = WatchedTable()
        watched.raise()
        var answered: [String] = []

        let took = watched.table.answer("blocked-9", for: "claim") {
            answered.append($0.patienceID)
        }

        #expect(!took)
        #expect(answered.isEmpty)
        #expect(watched.waiting == ["blocked-1"])
    }

    /// What a standing allow needs from the table: one word covering every request already waiting
    /// on the same tool, lifted together and published once.
    @Test
    func `answering a whole predicate lifts every match in one publish`() {
        let watched = WatchedTable()
        watched.raise(tool: "Bash")
        watched.raise(tool: "Edit")
        watched.raise(tool: "Bash")
        let publishes = watched.published.count
        var answered: [String] = []

        let took = watched.table.answerAll(
            matching: { $0.toolName == "Bash" },
            for: "claim",
            with: { answered.append($0.patienceID) },
        )

        #expect(took)
        #expect(answered == ["blocked-1", "blocked-3"])
        #expect(watched.waiting == ["blocked-2"])
        #expect(watched.published.count == publishes + 1)
    }

    @Test
    func `answering a predicate nothing matches publishes nothing`() {
        let watched = WatchedTable()
        watched.raise(tool: "Bash")
        let publishes = watched.published.count

        let took = watched.table.answerAll(
            matching: { $0.toolName == "Edit" },
            for: "claim",
            with: { _ in },
        )

        #expect(!took)
        #expect(watched.published.count == publishes)
    }

    /// The peer went while Argo was still willing to wait, so its turn was cancelled: what it held
    /// goes in silence, and what another peer holds is untouched.
    @Test
    func `a gone peer takes only its own requests, and says nothing`() {
        let watched = WatchedTable()
        watched.raise(peer: 1)
        watched.raise(peer: 2)

        watched.table.peerGone(1, for: "claim")

        #expect(watched.waiting == ["blocked-2"])
        #expect(watched.published.last == ["blocked-2"])
        #expect(watched.refused.isEmpty)
    }

    @Test
    func `a peer that held nothing publishes nothing`() {
        let watched = WatchedTable()
        watched.raise(peer: 1)
        let publishes = watched.published.count

        watched.table.peerGone(7, for: "claim")

        #expect(watched.published.count == publishes)
    }

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

    /// One table serves every key the gate above it does, and a key's pile is its own: the `claude`
    /// gate holds one channel across every claim, so a withdrawal there must not touch a neighbour.
    @Test
    func `a key's pile is its own, and a withdrawal leaves the others standing`() {
        let watched = WatchedTable()
        watched.raise()
        _ = watched.table.raise(for: "other") {
            Blocked(patienceID: $0, toolName: "Bash", patiencePeer: 1)
        }

        watched.table.withdraw("claim")

        #expect(watched.waiting.isEmpty)
        #expect(watched.table.pending(for: "other").map(\.patienceID) == ["blocked-2"])
    }
}
