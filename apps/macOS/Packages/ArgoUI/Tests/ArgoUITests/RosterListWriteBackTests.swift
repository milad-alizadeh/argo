@testable import ArgoUI
import Testing

/// What the roster's own `List` writes back, over a Session Argo has just started (#1493).
///
/// Its own suite and not `RosterSelectionFromTicketStartTests`': that one asks what survives
/// reconciliation, and this asks what survives the platform. Two different writers of the one
/// selection.
///
/// Driven through `RowSelectionHold.listSelection`, which is the binding `SessionNavigator` hands
/// the `List` — so a call site written without the rule fails here.
@Suite("The roster list's own write-back")
@MainActor
struct RosterListWriteBackTests {
    private typealias Start = TicketStartFixture

    /// A `List` can only name rows it is DRAWING, so with the window pointed at a claim whose row
    /// is not published yet the set the platform writes back is empty. Absorbing it moved
    /// `selection.last`, which is what `RowSelectionReactions` reads to repoint the deck — so the
    /// deck left the fresh Session with neither reconciliation nor the reader having any say.
    @Test
    func `survives the roster list writing its own selection back`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        Start.hold(navigation).listSelection(over: Start.standing.map(\.id)).wrappedValue = []

        #expect(
            navigation.sessionSelection.rows == [Start.claim],
            "The list's write-back dropped the row the window is waiting for.",
        )
        #expect(
            navigation.sessionSelection.last == navigation.session,
            "The list's write-back moved the drawn row, which is what repoints the deck.",
        )
    }

    /// And the reader is not pinned there while they wait. A write-back that NAMES a row is a
    /// click on that row, and it moves the deck off the fresh Session like any other click does.
    @Test
    func `lets a click made during the wait move the deck off it`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        Start.hold(navigation).listSelection(over: Start.standing.map(\.id))
            .wrappedValue = ["beta"]

        #expect(navigation.sessionSelection.last == "beta")
    }
}
