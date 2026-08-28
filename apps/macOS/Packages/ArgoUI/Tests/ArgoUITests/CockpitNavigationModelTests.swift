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

    @Test
    func `a session leaving the roster repoints the selection to the first`() {
        let model = CockpitNavigationModel()
        model.session = "b"
        model.reconcile(against: ["a", "c"])
        #expect(model.session == "a")
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
