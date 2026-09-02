import ArgoDesign
import ArgoEngine
import SwiftUI

/// A roster with Sessions behind its foot: the kept rows, and `Archived (n)` under them. The
/// judgement the PNG exists for is how QUIET the foot is.
struct ArchivedRosterSpecimen: View {
    /// Whether the foot is drawn open. Reachable only by clicking it, so the open state needs a way
    /// in that is not a pointer.
    var isRevealed = false
    /// Which Session is selected. A row BEHIND the foot is the state the foot may not be shut in —
    /// the deck renders the selection, so the roster has to go on drawing a row for it
    /// (`cockpit-roster-archive-foot.md`, 2026-08-31).
    var selection: String?

    var body: some View {
        SessionNavigator(
            rows: Self.rows,
            archived: Self.archived,
            selection: .constant(selection),
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
            access: .managed,
            status: .running,
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#514-archive-session-swipe"),
            ),
        ),
        CockpitPresentation.Session(
            id: "merged",
            // Merged, and kept: the roster does not clear a Session on its branch's behalf
            // (#502, story 14), so this is the row that would have vanished under the old spec.
            title: "Correct the design docs the next session would design from",
            access: .managed,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(46))),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#504-correct-design-docs"),
            ),
        ),
        CockpitPresentation.Session(
            id: "observed",
            title: "Watch an externally launched agent work",
            access: .external,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(4 * 60))),
            work: .init(
                location: "/Users/milad/Developer/cockpit",
                workspace: .init(branch: "main"),
            ),
        ),
        CockpitPresentation.Session(
            id: "archived-running",
            title: "Answer a question nobody is going to read",
            access: .managed,
            status: .running,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(0))),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#498-roster-order"),
            ),
            annotations: .init(isArchived: true),
        ),
        CockpitPresentation.Session(
            id: "archived-old",
            title: "Rebuild the graphite ramp",
            access: .managed,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(6 * 24 * 60))),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#375-graphite-ion-blue"),
            ),
            annotations: .init(isArchived: true),
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
