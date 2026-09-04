import ArgoUI
import SwiftUI

/// The shell against a roster whose activity order keeps moving — two agents writing at once,
/// leapfrogging each other on the sort key, with a third Session arriving and ending as they go.
///
/// Watched over time rather than photographed — a held order and a settled one are the same
/// picture. `RosterOrderE2ETests` drives it.
///
/// The beat is deliberately slower than the transcript bursts it stands for: a churn faster than a
/// person can react to would be a blur rather than a swap anyone could catch being refused.
struct ChurningRosterSpecimen: View {
    private static let beat = Duration.milliseconds(900)
    /// How many beats the arriving Session is absent for, then present for. Long enough either way
    /// that a render lands inside one of them rather than on the boundary.
    private static let visit = 8

    @State private var navigation = CockpitNavigationModel()
    @State private var beat = 0

    var body: some View {
        CockpitView(presentation: Self.presentation(at: beat), actions: .inert)
            .environment(navigation)
            .task {
                while true {
                    try? await Task.sleep(for: Self.beat)
                    // Cancellation is the only thing `sleep` throws, and swallowing it without
                    // asking would spin this loop as fast as the window can draw.
                    guard !Task.isCancelled else { return }
                    beat += 1
                }
            }
    }

    /// The roster the Hub would publish on this beat: newest activity first, recomputed from a
    /// key that moved. A pure function of the beat, so the sequence is the same every launch.
    private static func presentation(at beat: Int) -> CockpitPresentation {
        let settled = CockpitPresentation.preview
        var sessions = settled.sessions
        if !beat.isMultiple(of: 2), sessions.count > 1 {
            sessions.swapAt(0, 1)
        }
        if beat % (visit * 2) >= visit {
            sessions.insert(arriving, at: 0)
        }
        return CockpitPresentation(
            projects: settled.projects,
            activeProjectID: settled.activeProjectID,
            sessions: sessions,
            connection: settled.connection,
        )
    }

    /// The Session that starts while the reader is in the list and ends again later, at the front
    /// because it just wrote.
    private static let arriving = CockpitPresentation.Session(
        id: "arriving",
        title: "Start a Session while the roster is being read",
        access: .managed,
        status: .running,
        chain: .init(program: .init(model: "claude-opus-5")),
        work: .init(
            location: "/Users/milad/Developer/argo/.claude/worktrees/"
                + "ticket-498-roster-order-freeze",
            workspace: .init(kind: .worktree, branch: "argo/#498-roster-order-freeze"),
        ),
    )
}

#Preview("Churning roster") {
    ChurningRosterSpecimen()
        .frame(width: 1280, height: 800)
}
