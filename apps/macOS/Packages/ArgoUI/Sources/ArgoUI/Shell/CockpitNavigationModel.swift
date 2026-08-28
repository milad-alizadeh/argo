import ArgoEngine
import CoreGraphics
import Observation

/// Where one cockpit window is pointing: the room on screen and the Session it has selected.
///
/// Holds ids only, never model values — restoration reads a stale id and repoints, it never
/// resurrects a Session that no longer exists.
@Observable
public final class CockpitNavigationModel {
    /// The one field the app target touches: its Navigate menu sets the room.
    public var room: CockpitRoom = .sessions

    /// The ticket the Work room is open on. Beside the Session and not inside it: a room keeps
    /// where it was pointing while the reader is in another one.
    var ticket: Int?
    /// Which of the backlog's views is open. Here rather than in the sidebar, because it decides
    /// what the DECK draws — held inside the sidebar it filtered nothing.
    var workView = WorkView.allOpen
    /// Which parents the backlog has folded. Beside the view for the same reason: a fold survives
    /// the reader leaving the room. Empty, because everything opens open (#814).
    var shutParents: Set<Int> = []
    /// What the backlog's search field is holding. Beside the view for its reason: the field sits
    /// over the ticket and narrows the LIST, so neither pane may own it (#816).
    var workQuery = ""
    /// What the reader has dragged the Work room's seam to. A preference of the WINDOW, like the
    /// deck's own seams (`DeckSeams`) — the room's two panes are rebuilt on every ticket, and a
    /// width owned inside that subtree would lose the drag on every click.
    var backlogWidth = ArgoBacklogList.width
    /// The Mode a Session started from this room would start in. A standing choice of the window's,
    /// not of one ticket — the reader picks the rung they work at, not one per ticket.
    var workMode = SessionMode.code

    /// The Session on screen. Every write but reconciliation's is somebody picking a row, which is
    /// why the setter records one.
    var session: CockpitPresentation.Session.ID? {
        get { pointedSession }
        set {
            pointedSession = newValue
            chosenSession = Pick(session: newValue, ordinal: chosenSession.ordinal + 1)
        }
    }

    /// One act of picking a row. The ordinal is what makes picking the SAME row twice two events:
    /// a resume that was refused is retried by clicking again (#10), and on the id alone the second
    /// click would be no change at all.
    struct Pick: Equatable {
        var session: CockpitPresentation.Session.ID?
        var ordinal = 0
    }

    /// What the user PICKED, as opposed to what reconciliation landed on. Resuming a dead Session
    /// is an act of theirs, so a roster that repointed itself must start no agent — and at launch
    /// it repoints itself onto the first row.
    private(set) var chosenSession = Pick(session: nil)

    private var pointedSession: CockpitPresentation.Session.ID?

    public init() {}

    /// What a Project switch takes with it: the query alone, because it is the one thing here that
    /// is a question about a particular Project's tickets (#873). The view, the fold and the seam
    /// are the reader's own settings and stand.
    func projectSwitched() {
        workQuery = ""
    }

    /// Repoints a selection that no longer names a live Session, falling back to the first.
    /// An empty roster leaves it `nil` — there is nothing honest to point at.
    func reconcile(against sessionIDs: [CockpitPresentation.Session.ID]) {
        if let pointedSession, sessionIDs.contains(pointedSession) {
            return
        }
        pointedSession = sessionIDs.first
        chosenSession = Pick(session: nil, ordinal: chosenSession.ordinal + 1)
    }
}
