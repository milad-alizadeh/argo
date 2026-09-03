@testable import ArgoSpecimens
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
        var started: Int?
    }

    private func room(_ held: Held) -> TicketsRoom {
        TicketsRoom(
            room: TicketsFixture.room,
            cockpitRoom: .constant(.tickets),
            ticket: Binding(get: { held.ticket }, set: { held.ticket = $0 }),
            session: .constant(nil),
            view: Binding(get: { held.view }, set: { held.view = $0 }),
            backlogWidth: .constant(ArgoBacklogList.width),
            shut: .constant([]),
            starting: StartIntent(run: { held.started = $0 }, command: { _ in .implement }),
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

    /// The hero's second verb (#899). It addresses the pick by number, the way the open verb beside
    /// it does — the card knows which ticket it is offering and nothing else has to be told.
    @Test func `the hero's Start verb starts a Session on the pick`() {
        let held = Held()

        room(held).nextUpIntents.starting.run(607)

        #expect(held.started == 607)
    }

    /// Start is a second control and not a second meaning for the first: pressing it must not also
    /// open the ticket in the pane.
    @Test func `the hero's Start verb does not open the ticket beside it`() {
        let held = Held()

        room(held).nextUpIntents.starting.run(607)

        #expect(held.ticket == nil)
    }

    /// The card SAYS what it will send, so the reading has to reach it as well as the act.
    @Test func `the hero says which command its Start will send`() {
        #expect(room(Held()).nextUpIntents.starting.command(607) == .implement)
    }
}
