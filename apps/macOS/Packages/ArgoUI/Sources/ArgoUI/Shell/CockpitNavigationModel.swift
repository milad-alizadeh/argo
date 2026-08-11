import Observation

/// Where one cockpit window is pointing: the room on screen and the Session it has selected.
///
/// Holds ids only, never model values — restoration reads a stale id and repoints, it never
/// resurrects a Session that no longer exists.
@Observable
public final class CockpitNavigationModel {
    /// The one field the app target touches: its Navigate menu sets the room.
    public var room: CockpitRoom = .sessions

    /// The Session on screen. Every write but reconciliation's is somebody picking a row, which is
    /// why the setter records one.
    var session: CockpitPresentation.Session.ID? {
        get { pointedSession }
        set {
            pointedSession = newValue
            chosenSession = newValue
        }
    }

    /// The Session the user PICKED, as opposed to the one reconciliation landed on. Resuming a dead
    /// Session is an act of theirs (#10), so a roster that repointed itself must start no agent —
    /// and at launch it repoints itself onto the first row.
    private(set) var chosenSession: CockpitPresentation.Session.ID?

    private var pointedSession: CockpitPresentation.Session.ID?

    public init() {}

    /// Repoints a selection that no longer names a live Session, falling back to the first.
    /// An empty roster leaves it `nil` — there is nothing honest to point at.
    func reconcile(against sessionIDs: [CockpitPresentation.Session.ID]) {
        if let pointedSession, sessionIDs.contains(pointedSession) {
            return
        }
        pointedSession = sessionIDs.first
        chosenSession = nil
    }
}
