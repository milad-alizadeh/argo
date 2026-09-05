import ArgoEngine
import ArgoUI
import SwiftUI

/// #1404: a roster with more rows than a full-height window can hold. No other entry in the
/// catalog carries one, which is why nothing caught the sidebar column being divided between the
/// two rooms mounted in it (`RoomStage`). The claim is the LAST row, not the first.
struct ManyMixedRosterSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: Self.presentation, actions: .inert)
            .environment(navigation)
    }

    static let presentation = CockpitPresentation(
        projects: CockpitPresentation.previewProjects,
        activeProjectID: "argo",
        sessions: (0 ..< 15).map { session(at: $0) },
        connection: .connected,
    )

    private static func session(at index: Int) -> CockpitPresentation.Session {
        let statuses: [SessionStatus] = [
            .running, .permission, .idle, .stopped, .unknown,
        ]
        let status = statuses[index % statuses.count]
        let isExternal = index.isMultiple(of: 7)
        return CockpitPresentation.Session(
            id: "mixed-\(index)",
            title: "Session \(index + 1) — \(status) mixed roster row for #1404",
            access: isExternal ? .external : .managed,
            status: status,
            chain: .init(
                program: .init(
                    cli: index.isMultiple(of: 2) ? .claude : .codex,
                    model: "claude-opus-5",
                ),
                span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(index)),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(1404 + index)",
                workspace: .init(
                    kind: .worktree,
                    branch: "argo/#\(1404 + index)-work",
                    dirty: index % 5,
                    unpushed: index % 3,
                ),
            ),
            spend: .init(context: .held(1000 * (index + 1))),
        )
    }
}
