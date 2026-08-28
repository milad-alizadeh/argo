@testable import ArgoUI
import SwiftUI
import Testing

/// What pressing the Next-up hero does (#898): it opens the picked ticket, and it opens nothing
/// else. The hero ranks across the whole room, so the pick is regularly a ticket the open view does
/// not admit — and the act must still be one write, to the ticket alone.
@Suite("Next-up hero action")
@MainActor
struct NextUpActionTests {
    /// What the room's bindings are worth after a press. A class, so a `Binding` can write back to
    /// it from a test with no view above it.
    private final class Held {
        var ticket: Int?
        var view = TicketsView.blocked
    }

    private func room(_ held: Held) -> TicketsRoom {
        TicketsRoom(
            room: TicketsFixture.room,
            cockpitRoom: .constant(.tickets),
            ticket: Binding(get: { held.ticket }, set: { held.ticket = $0 }),
            view: Binding(get: { held.view }, set: { held.view = $0 }),
            backlogWidth: .constant(ArgoBacklogList.width),
            shut: .constant([]),
        )
    }

    @Test func `pressing the hero opens its ticket in the pane`() {
        let held = Held()

        room(held).nextUpIntents.open(607)

        #expect(held.ticket == 607)
    }

    /// The one thing the card must not do. It is a guard against an ADDITION rather than a deletion
    /// — nothing writes the view today, and this is what fails the day something does.
    @Test func `pressing the hero leaves the open view alone`() {
        let held = Held()

        room(held).nextUpIntents.open(607)

        #expect(held.view == .blocked)
    }
}
