@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// `CockpitView.ticketsRoom` is assembled in every room now, not only Tickets (#1356), so a
/// Project with no Ticket Binding reads `TicketsRoom.room.vacancy == .unbound` regardless of
/// which room is drawn. `roomHidesSidebar` used to get its gate for free from `tickets` being
/// `nil` outside Tickets; once it stopped being `nil` there, the room the vacancy names had to
/// be checked explicitly against the room actually on screen, or an unbound Tickets room would
/// hide the sidebar in every room, Sessions included.
@Suite("Sidebar vacancy gate")
@MainActor
struct SidebarVacancyGateTests {
    @Test
    func `an unbound Tickets room does not hide the sidebar in Sessions`() {
        let view = CockpitView(presentation: Self.presentation, actions: .inert)

        #expect(!view.roomHidesSidebar(Self.unbound, in: .sessions))
    }

    @Test
    func `an unbound Tickets room hides the sidebar in Tickets, as it always has`() {
        let view = CockpitView(presentation: Self.presentation, actions: .inert)

        #expect(view.roomHidesSidebar(Self.unbound, in: .tickets))
    }

    @Test
    func `a bound Tickets room hides nothing, in Tickets or anywhere else`() {
        let view = CockpitView(presentation: Self.presentation, actions: .inert)

        #expect(!view.roomHidesSidebar(Self.bound, in: .tickets))
        #expect(!view.roomHidesSidebar(Self.bound, in: .sessions))
    }

    private static var presentation: CockpitPresentation {
        CockpitPresentation(projects: [], activeProjectID: nil, sessions: [], connection: .idle)
    }

    private static var unbound: TicketsRoom {
        room(from: TicketsFixture.unbound)
    }

    private static var bound: TicketsRoom {
        room(from: TicketsFixture.reading)
    }

    private static func room(from reading: TicketsReading) -> TicketsRoom {
        TicketsRoom(
            room: TicketsRoomProjection.room(from: reading),
            cockpitRoom: .constant(.sessions),
            ticket: .constant(nil),
            session: .constant(nil),
            view: .constant(.allOpen),
            backlogWidth: .constant(320),
            shut: .constant([]),
        )
    }
}
