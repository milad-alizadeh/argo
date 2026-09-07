import ArgoEngine
import ArgoFixtures
import ArgoUI
import SwiftUI

/// The pair of surfaces #1575 was reported from, in one frame: a managed Session part-way through
/// a Plan, whose header carries **Create PR** and whose roster row carries no `Ready` badge.
///
/// The whole window rather than the deck alone, because the reading being judged is the PAIR — the
/// control was read as the verdict the row was withholding, and neither surface on its own shows
/// that. The Session is `running` with a part-done Plan and no companion claim, so the badge slot
/// is correctly empty and the control is correctly there.
struct MidTurnCreatePullRequestSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: Self.presentation, actions: .inert)
            .environment(navigation)
    }

    static let presentation = CockpitPresentation(
        projects: CockpitPresentation.previewProjects,
        activeProjectID: "argo",
        sessions: [midTurn, external],
        connection: .connected,
    )

    /// First, so the roster points at it and the deck draws its header.
    private static var midTurn: CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "mid-turn",
            title: "Take the accent off Create PR",
            access: .managed,
            status: .running,
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(0)),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-1575",
                workspace: .init(kind: .worktree, branch: "argo/#1575-create-pr-ink"),
            ),
            spend: .init(context: .held(84000)),
            transcript: .init(events: [TranscriptFixtures.plan(plan)]),
        )
    }

    /// Beside it, the posture that is offered no control at all — so the frame also says the
    /// presence rule is `access` and nothing else.
    private static var external: CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "external",
            title: "A Session nobody here started",
            access: .external,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(12))),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "main"),
            ),
        )
    }

    /// Step 1 of 10 is the ticket's own example; six steps is what the bar can show apart.
    private static let plan: [(String, PlanEntryStatus)] = [
        ("Read the header projection", .completed),
        ("Take the accent off the control", .inProgress),
        ("Pin the ink in the suite", .pending),
        ("Settle the rule in the design", .pending),
        ("Render the pair together", .pending),
        ("Independent review, then PR", .pending),
    ]
}
