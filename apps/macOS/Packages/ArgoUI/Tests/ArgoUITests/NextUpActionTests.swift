@testable import ArgoUI
import SwiftUI
import Testing

/// What the Next-up hero's open verb writes (#898). Nothing here presses anything — the seam is
/// the intents `TicketsRoom` builds, which is where the act is decided.
@Suite("Next-up hero verbs")
@MainActor
struct NextUpActionTests {
    /// What the room's bindings are worth afterwards. A class, so a `Binding` can write back to it
    /// with no view above it.
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

    @Test func `the hero's open verb writes the ticket the pane draws`() {
        let held = Held()

        room(held).nextUpIntents.open(607)

        #expect(held.ticket == 607)
    }

    /// The one thing the card must not do. It is a guard against an ADDITION rather than a deletion
    /// — nothing writes the view today, and this is what fails the day something does.
    @Test func `the hero's open verb leaves the open view alone`() {
        let held = Held()

        room(held).nextUpIntents.open(607)

        #expect(held.view == .blocked)
    }
}
