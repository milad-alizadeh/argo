@testable import ArgoUI
import Testing

/// Pressing `Start` on a ticket leaves the window looking at the Session it just began, and keeps
/// it there while that Session is re-keyed underneath (#1493).
///
/// The state this refuses is the report's: the room switches, and a second later the deck draws
/// another Session and the roster grounds another row. What makes this route its own case is the
/// id being written. `TicketsRoom.openSession` writes a row id and its re-key is incidental; the
/// spawn answers a `SessionOwnership.ClaimID`, which the Hub is GUARANTEED to retire the moment
/// the CLI writes its first record (#361). So the re-key here is not a hazard the route might
/// meet — it is the route.
///
/// Driven through the real `TicketStart.run`, over a real `CockpitNavigationModel`, because the
/// question is whether that act's write survives the reconciliation that follows it. A test that
/// set `session` by hand would answer a question nobody asked.
@Suite("A Session started on a ticket")
@MainActor
struct RosterSelectionFromTicketStartTests {
    /// The roster this route lands in, and the wiring that lands it there — see
    /// `TicketStartFixture`, which the write-back suite reads the same setup from.
    private typealias Start = TicketStartFixture

    /// The fresh Session is deliberately NOT first in the published order: first is the one place
    /// the old fallback landed on by luck, and a test standing there would pass on a bug.
    @Test
    func `is the row the roster grounds`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.provisional.map(\.identity))

        RosterMark.expect(Start.claim, in: Start.provisional, for: navigation)
    }

    /// The report, at the pass the running app actually fails on, and the half no test had.
    ///
    /// The spawn answers its claim and the window is pointed at it, but the roster reconciles at
    /// least once BEFORE the provisional row reaches the shell — the Hub publishes it and the
    /// presentation is rebuilt on its own beat. That pass sees an id no row accounts for and, on
    /// ids alone, cannot tell it from a Session that ended, so the deck and the ground left for
    /// another row before the fresh Session ever had one. Nothing downstream could recover from
    /// that: by the time the row arrives the window is pointed somewhere else entirely.
    ///
    /// Verified in the running app before it was written: pressing Start put `/implement 1502` on
    /// the roster and left the deck on the Session that was selected before the press.
    @Test
    func `holds the window on a Session whose row the roster has not published yet`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.standing.map(\.identity))

        #expect(
            navigation.session == Start.claim,
            "The window left the Session it started before its row was ever published.",
        )
        navigation.reconcile(against: Start.provisional.map(\.identity))
        RosterMark.expect(Start.claim, in: Start.provisional, for: navigation)
    }

    /// And the whole route in one pass: pointed before the row exists, published, then re-keyed.
    @Test
    func `holds it from the press through the publish to the re-key`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.standing.map(\.identity))
        navigation.reconcile(against: Start.provisional.map(\.identity))
        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        RosterMark.expect(Start.cli, in: Start.rekeyed, for: navigation)
    }

    /// The other seam that moves the deck, and the one that actually beat the fix in the running
    /// app: the roster confines its selection to the rows the list is DRAWING
    /// (`RowSelectionReactions`), and an unpublished row is not drawn. Confining dropped the
    /// selection a spawn had just made, which moved `selection.last`, which repointed the deck —
    /// all without reconciliation having any say. So the awaited row is named here, and the list
    /// keeps it.
    @Test
    func `names the row the roster must not confine away`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)

        #expect(navigation.awaitedSession == Start.claim)
        var selection = navigation.sessionSelection
        selection.confine(to: Start.standing.map(\.id) + [Start.claim])

        #expect(
            selection.rows == [Start.claim],
            "The list confined away the row the window is waiting for.",
        )
    }

    /// And it stops being awaited the moment its row is on the roster, so an id that has genuinely
    /// gone from there on is treated as gone.
    @Test
    func `stops awaiting the row once the roster publishes it`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.provisional.map(\.identity))

        #expect(navigation.awaitedSession == nil)
    }

    @Test
    func `leaves the window in the Sessions room`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)

        #expect(navigation.room == .sessions)
    }

    /// The report itself. The provisional row stands under the claim, the CLI's first record
    /// re-keys it, and the deck and the ground both have to arrive at the new id rather than at
    /// whatever the roster happens to list first.
    @Test
    func `holds the deck and the ground across the re-key of its claim`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.provisional.map(\.identity))
        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        RosterMark.expect(Start.cli, in: Start.rekeyed, for: navigation)
    }

    /// The same re-key, reached without the pass in between: the roster can publish the CLI's id
    /// before the shell has reconciled the provisional row at all, and the claim is then an id
    /// this model has never seen on a roster. It is still the Session the reader started.
    @Test
    func `holds them when the re-key lands before the provisional row is reconciled`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        RosterMark.expect(Start.cli, in: Start.rekeyed, for: navigation)
    }

    /// A followed re-key is not a Session going away. `chosenSession` records the act of PICKING,
    /// and clearing it is what tells `resumeIfSelectionIsDead` a Session died — so a re-key that
    /// cleared it would start an agent nobody asked for (#10).
    @Test
    func `is not read as a Session that died when its claim is retired`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.provisional.map(\.identity))
        let picked = navigation.chosenSession
        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        #expect(navigation.chosenSession == picked, "The re-key was read as a repoint.")
        #expect(navigation.chosenSession.session != nil, "The pick was cleared.")
    }

    /// The reveal this route owes, and why it is a different debt from #1273's. `openSession`
    /// names a row the roster is already drawing; a claim id is written the instant the spawn
    /// answers, which can be before the provisional row has reached the rows this list has. A
    /// selection naming no drawn row used to owe nothing at all, so the row could be grounded and
    /// still scrolled out of sight — which reads to the reader exactly like a lost focus.
    ///
    /// One test over both halves, because the claim of this route is the pair: the debt is taken
    /// before the row exists and settled when it arrives, with the selection unchanged in between.
    /// The change that pays it is the ROSTER's, not the reader's.
    @Test
    func `owes the scroll until the roster publishes the row it started`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)

        let before = RosterListing().reading(of: Start.standing, selection: navigation.session)
        #expect(
            SessionRosterProjection.reveal(
                of: navigation.session, among: before.rows, hasHeight: true,
            ) == .init(row: nil, owed: Start.claim),
        )
        let after = RosterListing().reading(of: Start.provisional, selection: navigation.session)
        #expect(
            SessionRosterProjection.reveal(
                of: navigation.session, among: after.rows, hasHeight: true,
            ) == .init(row: Start.claim, owed: nil),
        )
    }
}
