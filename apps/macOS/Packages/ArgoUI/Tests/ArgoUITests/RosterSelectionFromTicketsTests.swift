@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// Opening a Session from the Tickets room leaves the roster marking its row, and pointing the
/// list at it (#1273).
///
/// The state this refuses is the report's: the deck's header names #1238, every row on the roster
/// draws the plain ground, and the row for the Session being read is not on screen. The reader
/// cannot tell which Session they are in.
///
/// Driven through the REAL route — `TicketsRoom.openSession`, over bindings onto a real
/// `CockpitNavigationModel`, exactly as `CockpitView+Tickets.swift` wires them — because the
/// question the report asks is whether that route reaches the binding the `List` reads. A test
/// that set `selection` by hand would answer a question nobody had.
@Suite("A Session opened from Tickets")
@MainActor
struct RosterSelectionFromTicketsTests {
    @Test
    func `is the row the roster grounds`() {
        let navigation = navigation(over: sessions("alpha", "beta", "gamma"))

        room(navigation).openSession("gamma")

        RosterMark.expect("gamma", in: sessions("alpha", "beta", "gamma"), for: navigation)
    }

    /// The second half of the report, over the route it happens on. `openSession` writes the
    /// selection while the Tickets room is still the one on screen, which leaves the roster's own
    /// list mounted at no height (`RoomStage`) — so the reveal is OWED here, and paid when the
    /// room the reader is being sent to takes the column.
    @Test
    func `owes the scroll it cannot make from the room it was pressed in`() {
        let sessions = sessions("alpha", "beta", "gamma")
        let navigation = navigation(over: sessions)

        room(navigation).openSession("gamma")

        let reading = RosterListing().reading(of: sessions, selection: navigation.session)
        #expect(
            SessionRosterProjection.reveal(
                of: navigation.session, among: reading.rows, hasHeight: false,
            ) == .init(row: nil, owed: "gamma"),
        )
        #expect(
            SessionRosterProjection.reveal(
                of: navigation.session, among: reading.rows, hasHeight: true,
            ) == .init(row: "gamma", owed: nil),
        )
    }

    /// It also switches rooms, which is what makes the roster the surface the reader is looking at
    /// when the mark lands.
    @Test
    func `leaves the window in the Sessions room`() {
        let navigation = navigation(over: sessions("alpha", "beta"))

        room(navigation).openSession("beta")

        #expect(navigation.room == .sessions)
    }

    /// The Session re-keyed to the CLI's own id when its first record lands (#1176). One id goes
    /// and another arrives, and the roster's ground and the `List`'s own selection are the same
    /// state through it: `reconcile` follows the re-key once and both halves read what it wrote.
    ///
    /// The re-key here takes the head of the roster.
    @Test
    func `keeps the mark and the selection one state across a re-key`() {
        let navigation = navigation(over: sessions("alpha", "beta"))

        room(navigation).openSession("alpha")
        let rekeyed = [
            RosterSessionFixture.rekeyed("alpha-cli", from: "alpha"),
            RosterSessionFixture.session(id: "beta"),
        ]
        navigation.reconcile(against: rekeyed.map(\.identity))

        RosterMark.expect("alpha-cli", in: rekeyed, for: navigation)
    }

    /// The re-key that does NOT take the head, which used to be the honest limit here: nothing in
    /// the presentation said `beta-cli` was the Session that was `beta`, so `reconcile` read an id
    /// that stopped being published and fell back to the first row. The row now carries the id it
    /// retired (#1481), so the mark follows the Session rather than the position.
    ///
    /// This route's re-key is INCIDENTAL — `openSession` writes a row id, and a Session already
    /// carrying a transcript is never re-keyed again. The certain case is `Start` on a ticket,
    /// which writes a claim id the Hub retires the moment the CLI writes its first record: see
    /// `RosterSelectionFromTicketStartTests` (#1493). One rule serves both, and each route holds
    /// it over its own act.
    @Test
    func `hands the mark on with the deck when a re-key drops the id`() {
        let navigation = navigation(over: sessions("alpha", "beta"))

        room(navigation).openSession("beta")
        let rekeyed = [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.rekeyed("beta-cli", from: "beta"),
        ]
        navigation.reconcile(against: rekeyed.map(\.identity))

        RosterMark.expect("beta-cli", in: rekeyed, for: navigation)
    }

    // MARK: - The shell's own wiring

    /// The room as `CockpitView.ticketsRoom` assembles it: every binding it writes points at the
    /// navigation model, so a write here is the write the shell makes.
    private func room(_ navigation: CockpitNavigationModel) -> TicketsRoom {
        TicketsRoom(
            room: TicketsFixture.room,
            cockpitRoom: Binding(get: { navigation.room }, set: { navigation.room = $0 }),
            ticket: Binding(get: { navigation.ticket }, set: { navigation.ticket = $0 }),
            session: Binding(get: { navigation.session }, set: { navigation.session = $0 }),
            view: .constant(.allOpen),
            backlogWidth: .constant(ArgoBacklogList.width),
            shut: .constant([]),
        )
    }

    /// A window as `CockpitView.body` leaves it on first draw: reconciled once, in the Tickets
    /// room, which is where the reader is standing when they press the claimant line.
    private func navigation(
        over sessions: [CockpitPresentation.Session],
    )
        -> CockpitNavigationModel {
        let navigation = CockpitNavigationModel()
        navigation.reconcile(against: sessions.map(\.identity))
        navigation.room = .tickets
        return navigation
    }

    private func sessions(_ ids: String...) -> [CockpitPresentation.Session] {
        ids.map { RosterSessionFixture.session(id: $0) }
    }
}
