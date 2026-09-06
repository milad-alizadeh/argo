import ArgoEngine
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
    /// The claim the spawn answers with, and the id the CLI picks a moment later.
    private static let claim = "claim-7"
    private static let cli = "claim-7-cli"

    /// The fresh Session is deliberately NOT first in the published order: first is the one place
    /// the old fallback landed on by luck, and a test standing there would pass on a bug.
    @Test
    func `is the row the roster grounds`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)
        navigation.reconcile(against: provisional.map(\.identity))

        RosterMark.expect(Self.claim, in: provisional, for: navigation)
    }

    @Test
    func `leaves the window in the Sessions room`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)

        #expect(navigation.room == .sessions)
    }

    /// The report itself. The provisional row stands under the claim, the CLI's first record
    /// re-keys it, and the deck and the ground both have to arrive at the new id rather than at
    /// whatever the roster happens to list first.
    @Test
    func `holds the deck and the ground across the re-key of its claim`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)
        navigation.reconcile(against: provisional.map(\.identity))
        navigation.reconcile(against: rekeyed.map(\.identity))

        RosterMark.expect(Self.cli, in: rekeyed, for: navigation)
    }

    /// The same re-key, reached without the pass in between: the roster can publish the CLI's id
    /// before the shell has reconciled the provisional row at all, and the claim is then an id
    /// this model has never seen on a roster. It is still the Session the reader started.
    @Test
    func `holds them when the re-key lands before the provisional row is reconciled`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)
        navigation.reconcile(against: rekeyed.map(\.identity))

        RosterMark.expect(Self.cli, in: rekeyed, for: navigation)
    }

    /// A followed re-key is not a Session going away. `chosenSession` records the act of PICKING,
    /// and clearing it is what tells `resumeIfSelectionIsDead` a Session died — so a re-key that
    /// cleared it would start an agent nobody asked for (#10).
    @Test
    func `is not read as a Session that died when its claim is retired`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)
        navigation.reconcile(against: provisional.map(\.identity))
        let picked = navigation.chosenSession
        navigation.reconcile(against: rekeyed.map(\.identity))

        #expect(navigation.chosenSession == picked, "The re-key was read as a repoint.")
        #expect(navigation.chosenSession.session != nil, "The pick was cleared.")
    }

    /// The reveal this route owes, and why it is a different debt from #1273's. `openSession`
    /// names a row the roster is already drawing; a claim id is written the instant the spawn
    /// answers, which can be before the provisional row has reached the rows this list has. A
    /// selection naming no drawn row used to owe nothing at all, so the row could be grounded and
    /// still scrolled out of sight — which reads to the reader exactly like a lost focus.
    @Test
    func `owes the scroll for a row the list is not drawing yet`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)

        let before = RosterListing().reading(of: standing, selection: navigation.session)
        #expect(
            SessionRosterProjection.reveal(
                of: navigation.session, among: before.rows, hasHeight: true,
            ) == .init(row: nil, owed: Self.claim),
        )
    }

    /// And pays it when the row arrives, without the selection having changed in between — the
    /// change that pays this debt is the ROSTER's, not the reader's.
    @Test
    func `pays that scroll when the row is published`() async {
        let navigation = navigation()

        await start().run(on: 899, in: navigation)
        let after = RosterListing().reading(of: provisional, selection: navigation.session)

        #expect(
            SessionRosterProjection.reveal(
                of: navigation.session, among: after.rows, hasHeight: true,
            ) == .init(row: Self.claim, owed: nil),
        )
    }

    // MARK: - The roster this Start lands in

    /// Three rows before the press, which is the report's own setup: enough that the first row is
    /// not the fresh one by accident.
    private var standing: [CockpitPresentation.Session] {
        ["alpha", "beta", "gamma"].map { RosterSessionFixture.session(id: $0) }
    }

    /// The provisional row the Hub publishes when the spawn returns, standing under the claim's
    /// own id (#872), second in the published order.
    private var provisional: [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.session(id: Self.claim),
            RosterSessionFixture.session(id: "beta"),
            RosterSessionFixture.session(id: "gamma"),
        ]
    }

    /// The same roster once the CLI has written its first record: the row is published under the
    /// id the CLI picked and carries the claim it retired.
    private var rekeyed: [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.rekeyed(Self.cli, from: Self.claim),
            RosterSessionFixture.session(id: "beta"),
            RosterSessionFixture.session(id: "gamma"),
        ]
    }

    // MARK: - The shell's own wiring

    /// The act as `CockpitView.ticketStart` assembles it, with the spawn answering what the real
    /// one answers: the claim id the provisional row is published under.
    private func start() -> TicketStart {
        TicketStart(
            tickets: [Ticket(number: 899, title: "Start", status: "Todo", closure: .open)],
            designs: { [] },
            spawn: { _, _, _ in Self.claim },
        )
    }

    /// A window as `CockpitView.body` leaves it on first draw: reconciled once over the roster
    /// standing before the press, in the Tickets room, which is where the reader pressed Start.
    private func navigation() -> CockpitNavigationModel {
        let navigation = CockpitNavigationModel()
        navigation.reconcile(against: standing.map(\.identity))
        navigation.room = .tickets
        return navigation
    }
}
