@testable import ArgoUI
import Testing

/// What the roster's list may narrow away, over a Session Argo has just started (#1493).
///
/// The list confines its selection to the rows it is DRAWING, and the drawn rows are a beat behind
/// the roster: a Session re-keyed the moment its transcript appears (#361) is on the roster under
/// its new id before the list has admitted it (`RosterOrder`). So `confine` drops it, and the
/// dropped row is what the surface beside the list follows.
///
/// Found in the running app, not by reading: with the trace on, `RowSelectionReactions` called
/// `pick(nil)` a few seconds after `Start`, and the reconciliation that followed had a `nil` to
/// repoint from rather than the claim it could have followed.
@Suite("The roster list's own narrowing")
@MainActor
struct RosterListConfineTests {
    private typealias Start = TicketStartFixture

    /// The report itself, at the pass the app fails on. The row is published, then re-keyed, and
    /// the list has not drawn the new id yet.
    @Test
    func `holds the deck when the list has not drawn the re-keyed row yet`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        navigation.reconcile(against: Start.provisional.map(\.identity))
        navigation.reconcile(against: Start.rekeyed.map(\.identity))
        // The list is still drawing the rows it had before the re-key, which is where the new id
        // is not.
        let held = Start.hold(navigation)
        held.confineToDrawn(Start.provisional.map(\.id))
        held.followClick(to: navigation.sessionSelection.last)

        #expect(
            navigation.session == Start.cli,
            "The list's confining took the deck off the Session that was just started.",
        )
        #expect(
            navigation.sessionSelection.rows == [Start.cli],
            "The roster grounds nothing: the ground is drawn from this set.",
        )
        #expect(
            navigation.chosenSession.session != nil,
            "A row the list stopped drawing was read as a Session the reader let go of.",
        )
    }

    /// And a click still moves it, because a click always names a row.
    @Test
    func `still follows a row the reader clicks`() async {
        let navigation = Start.navigation()

        await Start.start().run(on: 899, in: navigation)
        Start.hold(navigation).followClick(to: "beta")

        #expect(navigation.session == "beta")
    }
}
