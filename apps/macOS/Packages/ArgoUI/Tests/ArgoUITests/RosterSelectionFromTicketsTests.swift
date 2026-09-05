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
        let navigation = navigation(over: ids("alpha", "beta", "gamma"))

        room(navigation).openSession("gamma")

        expectMarked("gamma", in: ids("alpha", "beta", "gamma"), for: navigation)
    }

    /// The second half of the report. A row thirty down is marked and unreadable, so the list is
    /// asked for it — and the id it is asked for is the id the ground was drawn on.
    @Test
    func `is the row the roster scrolls to`() {
        let sessions = ids("alpha", "beta", "gamma")
        let navigation = navigation(over: sessions)

        room(navigation).openSession("gamma")

        let reading = RosterListing().reading(of: sessions, selection: navigation.session)
        #expect(
            SessionRosterProjection.rowToReveal(for: navigation.session, among: reading.rows)
                == "gamma",
        )
    }

    /// It also switches rooms, which is what makes the roster the surface the reader is looking at
    /// when the mark lands.
    @Test
    func `leaves the window in the Sessions room`() {
        let navigation = navigation(over: ids("alpha", "beta"))

        room(navigation).openSession("beta")

        #expect(navigation.room == .sessions)
    }

    /// The Session re-keyed to the CLI's own id when its first record lands (#1176). The roster's
    /// row and the shell's selection are re-pointed by the same reconciliation, so the mark stays
    /// on the Session the reader opened rather than falling off it.
    @Test
    func `stays on the Session after it is re-keyed`() {
        let navigation = navigation(over: ids("alpha", "beta"))

        room(navigation).openSession("alpha")
        let rekeyed = ids("alpha-cli", "beta")
        navigation.reconcile(against: rekeyed.map(\.id))

        expectMarked("alpha-cli", in: rekeyed, for: navigation)
    }

    // MARK: - The claim

    /// The roster's ONE selected state, read the way the sidebar reads it: the rows the list is
    /// drawing, and the ground under exactly one of them. The expected id is NAMED, so a roster
    /// grounding the wrong row still fails.
    private func expectMarked(
        _ expected: String,
        in sessions: [CockpitPresentation.Session],
        for navigation: CockpitNavigationModel,
    ) {
        let reading = RosterListing().reading(of: sessions, selection: navigation.session)
        let selection = SessionRosterProjection.Selection(named: navigation.session)
        let grounded = reading.rows.filter { selection.isSelected($0) }

        #expect(grounded.map(\.id) == [expected], "The roster grounds no row, or two.")
        #expect(
            navigation.session == grounded.first?.id,
            "The `List`'s own selection and the ground name two different rows.",
        )
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
        navigation.reconcile(against: sessions.map(\.id))
        navigation.room = .tickets
        return navigation
    }

    private func ids(_ ids: String...) -> [CockpitPresentation.Session] {
        ids.map { RosterSessionFixture.session(id: $0) }
    }
}
