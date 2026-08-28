@testable import ArgoUI
import Testing

/// One window, one compose mark (#836). Mail's window creates one kind of thing and spends one
/// compose button on it; Argo's rooms create two different things, so which mark a room spends is
/// decided per room rather than once for the bar.
@Suite("The room's compose verb")
struct TicketsComposeMarkTests {
    /// Mail's window creates one kind of thing and spends one compose mark on it (#836). The Work
    /// room creates a ticket, so the bar's own compose verb — New Session — is not drawn there.
    @Test
    func `only the rooms that make a Session spend the bar's compose verb on one`() {
        #expect(!CockpitRoom.tickets.spawnsSessions)
        #expect(CockpitRoom.sessions.spawnsSessions)
        #expect(CockpitRoom.code.spawnsSessions)
    }

    /// The two facts are ONE decision, asserted together: the ticket may wear the compose mark
    /// precisely because New Session is not in the bar beside it. Putting New Session back without
    /// re-cutting this mark would leave two compose marks a finger apart, each making a different
    /// thing — which is what the plus was there to prevent before the room stopped drawing both.
    @Test
    func `the room that spawns no Session is the one that composes a ticket`() {
        #expect(ArgoSymbol.newTicket == ArgoSymbol.newSession)
        #expect(!CockpitRoom.tickets.spawnsSessions)
    }
}
