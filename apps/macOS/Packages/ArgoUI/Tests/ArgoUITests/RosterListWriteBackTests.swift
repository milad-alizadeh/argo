@testable import ArgoUI
import Testing

/// What the roster's own `List` writes back, over a Session Argo has just started (#1493).
///
/// Its own suite and not `RosterSelectionFromTicketStartTests`': that one asks what survives
/// RECONCILIATION, and this asks what survives the platform. They are two different writers of
/// the one selection, and the route's third fix was needed because closing the first said nothing
/// about the second.
@Suite("The roster list's own write-back")
@MainActor
struct RosterListWriteBackTests {
    private typealias Start = TicketStartFixture

    /// The third narrowing seam, and the one nobody had closed: the roster's `List` writes its
    /// own selection back through `SessionNavigator.listSelection`. The platform can only name
    /// rows it is DRAWING, so with the window pointed at a claim whose row is not published yet
    /// the set it writes back is EMPTY — and absorbing that dropped `selection.last`, which is
    /// what `RowSelectionReactions` reads to repoint the deck. So the deck moved off the fresh
    /// Session with neither reconciliation nor the reader having any say.
    ///
    /// This is the pass the running app was still failing on after the first three fixes: the
    /// app's own trace showed `session = nil` arriving between the press and the first
    /// reconciliation, and `pick(nil)` off a moved `last` is the only write on this route that
    /// can produce it.
    @Test
    func `survives the roster list writing its own selection back`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        Start.hold(navigation).absorbFromList([], over: Start.standing.map(\.id))

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
        Start.hold(navigation).absorbFromList(["beta"], over: Start.standing.map(\.id))

        #expect(navigation.sessionSelection.last == "beta")
    }
}
