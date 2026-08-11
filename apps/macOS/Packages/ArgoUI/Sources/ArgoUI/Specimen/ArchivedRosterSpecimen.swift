import ArgoEngine
import SwiftUI

/// A roster with Sessions behind its foot: the kept rows, and `Archived (n)` under them. The
/// judgement the PNG exists for is how QUIET the foot is.
struct ArchivedRosterSpecimen: View {
    /// Whether the foot is drawn open. Reachable only by clicking it, so the open state needs a way
    /// in that is not a pointer.
    var isRevealed = false

    var body: some View {
        SessionNavigator(
            rows: Self.rows,
            archived: Self.archived,
            selection: .constant(nil),
            isArchiveRevealed: isRevealed,
        )
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }

    static let rows = SessionRosterProjection.rows(from: sessions)
    static let archived = SessionRosterProjection.archivedRows(from: sessions)

    /// Two archived and three kept, because `Archived (1)` would leave the label's plural
    /// unrendered. One archived Session is RUNNING and carries the newest activity here: story 16,
    /// that a Session does not come back because something moved in it.
    private static let sessions = [
        CockpitPresentation.Session(
            id: "shell",
            title: "Ship the native Liquid Glass application shell",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .running,
            workspace: .init(branch: "argo/#514-archive-session-swipe"),
        ),
        CockpitPresentation.Session(
            id: "merged",
            // Merged, and kept: the roster does not clear a Session on its branch's behalf
            // (#502, story 14), so this is the row that would have vanished under the old spec.
            title: "Correct the design docs the next session would design from",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            workspace: .init(branch: "argo/#504-correct-design-docs"),
            lastSeenAtMs: CockpitPresentation.minutesAgo(46),
        ),
        CockpitPresentation.Session(
            id: "observed",
            title: "Watch an externally launched agent work",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/cockpit",
            access: .external,
            status: .idle,
            workspace: .init(branch: "main"),
            lastSeenAtMs: CockpitPresentation.minutesAgo(4 * 60),
        ),
        CockpitPresentation.Session(
            id: "archived-running",
            title: "Answer a question nobody is going to read",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .running,
            workspace: .init(branch: "argo/#498-roster-order"),
            lastSeenAtMs: CockpitPresentation.minutesAgo(0),
            isArchived: true,
        ),
        CockpitPresentation.Session(
            id: "archived-old",
            title: "Rebuild the graphite ramp",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            workspace: .init(branch: "argo/#375-graphite-ion-blue"),
            lastSeenAtMs: CockpitPresentation.minutesAgo(6 * 24 * 60),
            isArchived: true,
        ),
    ]
}

#Preview("Archived roster — three kept, two behind the foot") {
    ArchivedRosterSpecimen()
        .frame(height: 420)
        .argoAppearance()
}

#Preview("Archived roster — the foot open") {
    ArchivedRosterSpecimen(isRevealed: true)
        .frame(height: 420)
        .argoAppearance()
}
