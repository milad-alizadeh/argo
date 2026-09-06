@testable import ArgoUI
import Testing

/// The one rule that moves the reader's selection without a click (#1481).
///
/// Every other write of `navigation.session` is an act of theirs or a spawn they started, so this
/// is where a Session changing under a reader comes from — and the roster it reconciles against is
/// ordered newest-activity first (#1402), which is what makes landing on its first row the wrong
/// answer rather than merely an arbitrary one.
@Suite("Cockpit navigation reconciliation")
struct CockpitNavigationReconcileTests {
    @Test
    func `a selection that still names a live session is left alone`() {
        let model = CockpitNavigationModel()
        model.session = "b"
        model.reconcile(against: ["a", "b", "c"])
        #expect(model.session == "b")
    }

    /// With no previous pass to read a neighbour off — a restored window, a fixture, a launch —
    /// the first row is all there is, and that is the one case it is honest to land on.
    @Test
    func `a session leaving a roster this window never saw repoints to the first`() {
        let model = CockpitNavigationModel()
        model.session = "b"
        model.reconcile(against: ["a", "c"])
        #expect(model.session == "a")
    }

    /// The rule the report is about (#1481). The roster is ordered newest-activity first (#1402),
    /// so its first row is whichever Session last did something — landing there is exactly how a
    /// reader ends up reading the Session that has just appeared.
    @Test
    func `a departed session lands on the row below it, not the newest`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["a", "b", "c", "d"])
        model.session = "c"

        model.reconcile(against: ["a", "b", "d"])

        #expect(model.session == "d")
    }

    /// The bottom of the list has nothing below it, so the rule turns round rather than falling to
    /// the far end of the roster.
    @Test
    func `a departed last row lands on the one above it`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["a", "b", "c"])
        model.session = "c"

        model.reconcile(against: ["a", "b"])

        #expect(model.session == "b")
    }

    /// Both neighbours gone in one pass — a Project's whole tail archived at once — so the walk
    /// carries on outwards rather than giving up at the first missing row.
    @Test
    func `a departed row whose neighbours went with it lands on the nearest survivor`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["a", "b", "c", "d", "e"])
        model.session = "c"

        model.reconcile(against: ["a", "e"])

        #expect(model.session == "e")
    }

    /// The absorption itself (#1481). A resume file read before its origin stands as a Session of
    /// its own, and the sweep that finds the origin folds it in: the reader is on the same Session
    /// under the id it is published as now, and moving them anywhere is the bug.
    @Test
    func `a selection a row absorbed follows it rather than being repointed`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["child", "other"])
        model.session = "child"
        let picked = model.chosenSession

        model.reconcile(against: [RosterIdentity("root", absorbing: ["child"]), "other"])

        #expect(model.session == "root")
        // Untouched, ordinal included: the reader picked this Session and has not picked another,
        // so `resumeIfSelectionIsDead` must not fire on a row the roster re-keyed (#10).
        #expect(model.chosenSession == picked)
    }

    /// The control for the case above: an id no row accounts for HAS gone, and that is the one
    /// reading that may move the reader.
    @Test
    func `a session no row absorbed is read as gone`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["a", "b", "c"])
        model.session = "b"

        model.reconcile(against: [RosterIdentity("a", absorbing: ["elsewhere"]), "c"])

        #expect(model.session == "c")
        #expect(model.chosenSession.session == nil)
    }

    /// The range the reader built by shift-click (#1247) is re-keyed, never widened or cut: a row
    /// changing the id it is published under is not a click.
    @Test
    func `a range holding an absorbed row follows it without widening`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["a", "child", "c"])
        model.sessionSelection = RowSelection(range: ["a", "child"])

        model.reconcile(against: ["a", RosterIdentity("root", absorbing: ["child"]), "c"])

        #expect(model.sessionSelection.rows == ["a", "root"])
    }
}
