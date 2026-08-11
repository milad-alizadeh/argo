import Observation

/// Where one cockpit window is pointing: the room on screen and the Session it has selected.
///
/// Holds ids only, never model values — restoration reads a stale id and repoints, it never
/// resurrects a Session that no longer exists.
@Observable
public final class CockpitNavigationModel {
    /// The one field the app target touches: its Navigate menu sets the room.
    public var room: CockpitRoom = .sessions
    var session: CockpitPresentation.Session.ID?

    public init() {}

    /// Repoints a selection that no longer names a live Session, falling back to the first.
    /// An empty roster leaves it `nil` — there is nothing honest to point at.
    func reconcile(against sessionIDs: [CockpitPresentation.Session.ID]) {
        if let session, sessionIDs.contains(session) {
            return
        }
        session = sessionIDs.first
    }
}
