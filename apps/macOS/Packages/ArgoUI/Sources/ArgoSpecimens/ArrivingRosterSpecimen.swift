import ArgoEngine
import ArgoUI
import SwiftUI

/// A roster longer than the window that GAINS a Session at its head while it is being read
/// (#1235). What is being asked is what the list does to its own scroll offset when a row lands
/// above the one at the top, and a still roster has not been asked that question.
///
/// Held down first when `offset` says so, which is the second half of the claim: a reader who has
/// scrolled must not have the rows under the pointer moved by somebody else's Session starting.
struct ArrivingRosterSpecimen: View {
    /// How far the roster is held down before the Session arrives. `0` is the reader at the top.
    var offset: CGFloat = 0

    /// How long the roster is left settled before the row lands. The render script captures half a
    /// second after the window opens, so this has to be short enough to leave the arrival inside
    /// the frame and long enough for the hold above to have taken.
    private static let settle = Duration.milliseconds(250)

    @State private var navigation = CockpitNavigationModel()
    @State private var hasArrived = false

    var body: some View {
        CockpitView(presentation: presentation, actions: .inert)
            .environment(navigation)
            .background(RosterScrollHold(offset: offset, isHolding: !hasArrived))
            .task {
                try? await Task.sleep(for: Self.settle)
                hasArrived = true
            }
    }

    private var presentation: CockpitPresentation {
        let settled = ScrolledRosterSpecimen.presentation
        guard hasArrived else { return settled }
        return CockpitPresentation(
            projects: settled.projects,
            activeProjectID: settled.activeProjectID,
            sessions: [Self.arriving] + settled.sessions,
            connection: settled.connection,
        )
    }

    /// The Session that starts while the roster is being read, at the head because it just wrote.
    private static let arriving = CockpitPresentation.Session(
        id: "arriving",
        title: "A Session that started while the roster was being read",
        access: .managed,
        status: .running,
        chain: .init(
            program: .init(cli: .claude, model: "claude-opus-5"),
            span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(0)),
        ),
        work: .init(
            location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-1235-arriving",
            workspace: .init(kind: .worktree, branch: "argo/#1235-arriving"),
        ),
    )
}
