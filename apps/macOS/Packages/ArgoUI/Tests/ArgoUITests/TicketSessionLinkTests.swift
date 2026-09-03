@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// The route between a Session and its Ticket closes in both directions (#1092): the ticket head's
/// claimant line lands on the Session, and the tab line's Issue link — `navigation.ticket = n;
/// navigation.room = .tickets`, exactly what `argoOpenTicket` does in `CockpitView+Detail.swift` —
/// lands back on the Ticket it names.
@Suite("The Session/Ticket route")
@MainActor
struct TicketSessionLinkTests {
    /// A class, so the room's bindings can write back to it with no view above them — the same
    /// shape `NextUpActionTests.Held` takes for the room's other verbs.
    private final class Held {
        var ticket: Int?
        var session: CockpitPresentation.Session.ID?
        var cockpitRoom = CockpitRoom.tickets
    }

    private func room(_ held: Held) -> TicketsRoom {
        TicketsRoom(
            room: TicketsFixture.room,
            cockpitRoom: Binding(get: { held.cockpitRoom }, set: { held.cockpitRoom = $0 }),
            ticket: Binding(get: { held.ticket }, set: { held.ticket = $0 }),
            session: Binding(get: { held.session }, set: { held.session = $0 }),
            view: .constant(.allOpen),
            backlogWidth: .constant(ArgoBacklogList.width),
            shut: .constant([]),
        )
    }

    @Test func `pressing the head's claimant line opens the Sessions room on that Session`() {
        let held = Held()

        room(held).openSession("claimant-session")

        #expect(held.session == "claimant-session")
        #expect(held.cockpitRoom == .sessions)
    }

    /// The round trip: from a Session, open its Ticket — through the REAL `CockpitNavigationModel
    /// .openTicket`, which `argoOpenTicket` wraps and nothing else duplicates — then press the
    /// head's claimant line for the claimant the REAL `TicketClaims` join names for that ticket.
    /// The Session the window ends up looking at is the one it started from, not merely SOME
    /// Session, and not one hand-typed to match.
    @Test func `the round trip closes on the Session it started from`() throws {
        let navigation = CockpitNavigationModel()
        navigation.room = .sessions
        navigation.session = "session-388"

        // What the tab line's Issue link does — `argoOpenTicket` in `CockpitView+Detail.swift`
        // is exactly this call, wrapped in an environment closure.
        navigation.openTicket(388)

        #expect(navigation.ticket == 388)
        #expect(navigation.room == .tickets)

        // The Session named for #388 by the real join, off the fixture's own reading — not a
        // literal repeated by hand, which could drift from what the join actually places.
        let listing = TicketsListing(of: TicketsFixture.reading)
        let claimant = try #require(listing.claimants(of: 388).first)
        #expect(claimant.id == "session-388")

        let held = Held()
        held.ticket = navigation.ticket
        held.cockpitRoom = navigation.room

        // What pressing the ticket's own claimant line does, back in the Tickets room.
        room(held).openSession(claimant.id)

        #expect(held.session == navigation.session)
        #expect(held.cockpitRoom == .sessions)
    }
}
