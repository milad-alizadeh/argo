import ArgoEngine
import ArgoUI
import SwiftUI

/// The whole shell over a roster longer than the window, held a few points down (#1235).
///
/// The claim is about the EDGE between the rooms picker's strip and the roster under it: the strip
/// is a control over the pane, not an overlay, so at no offset may a row be drawn over it or under
/// it. A roster photographed at rest cannot say that, because at rest the first row is below the
/// strip whether the list stops there or scrolls through it.
struct ScrolledRosterSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: Self.presentation, actions: .inert)
            .environment(navigation)
            // A few points, which is the offset the reported render caught: far enough that a row
            // is crossing the strip's edge, not so far that it has passed.
            .background(RosterScrollHold(offset: 22))
    }

    /// A roster longer than any window this renders in, so the list is always scrollable and the
    /// offset above is always reachable.
    static let presentation = CockpitPresentation(
        projects: CockpitPresentation.previewProjects,
        activeProjectID: "argo",
        sessions: (0 ..< 24).map { session(at: $0) },
        connection: .connected,
    )

    /// One drivable Session. Every row takes selection and none folds: a fold is a different
    /// claim, and a row the reader cannot select is a row the edge case would be excused by.
    private static func session(at index: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "scrolled-\(index)",
            title: "Session \(index + 1) on a roster longer than the window",
            access: .managed,
            status: index == 0 ? .running : .idle,
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(index)),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(1235 + index)",
                workspace: .init(kind: .worktree, branch: "argo/#\(1235 + index)-work"),
            ),
        )
    }
}
