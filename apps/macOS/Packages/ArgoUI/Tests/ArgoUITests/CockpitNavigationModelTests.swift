@testable import ArgoUI
import Testing

/// What the window's one navigation value promises when the roster moves under it.
///
/// The behaviour used to live in a `CockpitView` `onChange` where nothing could reach it; these
/// are that behaviour, now addressable.
@Suite("Cockpit navigation model")
struct CockpitNavigationModelTests {
    @Test
    func `a window opens on the Sessions room with nothing selected`() {
        let model = CockpitNavigationModel()
        #expect(model.room == .sessions)
        #expect(model.session == nil)
    }

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

    @Test
    func `no selection takes the first session the roster offers`() {
        let model = CockpitNavigationModel()
        model.reconcile(against: ["a", "b"])
        #expect(model.session == "a")
    }

    @Test
    func `an empty roster leaves the selection nil rather than stale`() {
        let model = CockpitNavigationModel()
        model.session = "a"
        model.reconcile(against: [])
        #expect(model.session == nil)
    }

    /// A resume is an act of the user's (#10), so the model has to say which of the two moved the
    /// selection: they picked the row, or the roster repointed itself onto it.
    @Test
    func `a selection the user made is a chosen one`() {
        let model = CockpitNavigationModel()
        model.session = "b"
        #expect(model.chosenSession.session == "b")
    }

    @Test
    func `a selection reconciliation landed on was chosen by nobody`() {
        let model = CockpitNavigationModel()
        model.session = "b"
        model.reconcile(against: ["a", "c"])
        #expect(model.session == "a")
        #expect(model.chosenSession.session == nil)
    }

    /// Reconciliation that changes nothing is not a repoint, so what the user picked stands.
    @Test
    func `a live selection survives reconciliation as a chosen one`() {
        let model = CockpitNavigationModel()
        model.session = "b"
        model.reconcile(against: ["a", "b"])
        #expect(model.chosenSession.session == "b")
    }

    /// Picking the same row twice is two acts, not one. A resume that was refused is retried by
    /// clicking again, and on the id alone the second click would be no change at all (#10).
    @Test
    func `picking the same row twice is two picks`() {
        let model = CockpitNavigationModel()
        model.session = "a"
        let first = model.chosenSession
        model.session = "a"

        #expect(model.chosenSession != first)
        #expect(model.chosenSession.session == "a")
    }

    /// The query outlives the pane it was typed over (#873), and a Project switch is the only
    /// thing that takes it — which is a claim about every OTHER write to this model.
    @Test
    func `selecting a ticket leaves the backlog's query standing`() {
        let model = CockpitNavigationModel()
        model.ticketsQuery = "canvas"
        model.ticket = 336

        #expect(model.ticketsQuery == "canvas")
    }

    @Test
    func `switching room leaves the backlog's query standing`() {
        let model = CockpitNavigationModel()
        model.ticketsQuery = "canvas"
        model.room = .code

        #expect(model.ticketsQuery == "canvas")
    }

    /// The roster moving under the window is not a Project switch, and it is the one write here
    /// that already has side effects of its own.
    @Test
    func `a roster reconciliation leaves the backlog's query standing`() {
        let model = CockpitNavigationModel()
        model.ticketsQuery = "canvas"
        model.session = "b"
        model.reconcile(against: ["a", "c"])

        #expect(model.ticketsQuery == "canvas")
    }

    /// Carried across, it would silently narrow a list of tickets it was never typed against, and
    /// the heading's count would be counting a different Project's answer.
    @Test
    func `the backlog's query does not survive a Project switch`() {
        let model = CockpitNavigationModel()
        model.ticketsQuery = "canvas"
        model.projectSwitched()

        #expect(model.ticketsQuery.isEmpty)
    }

    /// The view, the fold and the seam are the reader's own settings rather than questions about
    /// one backlog, so a Project switch leaves them alone.
    @Test
    func `a Project switch leaves the reader's own settings alone`() {
        let model = CockpitNavigationModel()
        model.ticketsView = .blocked
        model.shutParents = [607]
        model.projectSwitched()

        #expect(model.ticketsView == .blocked)
        #expect(model.shutParents == [607])
    }

    @Test
    func `the room the window is in survives a roster change`() {
        let model = CockpitNavigationModel()
        model.room = .code
        model.session = "a"
        model.reconcile(against: [])
        #expect(model.room == .code)
    }
}
