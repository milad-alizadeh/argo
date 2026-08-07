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

    @Test
    func `the room the window is in survives a roster change`() {
        let model = CockpitNavigationModel()
        model.room = .code
        model.session = "a"
        model.reconcile(against: [])
        #expect(model.room == .code)
    }
}
