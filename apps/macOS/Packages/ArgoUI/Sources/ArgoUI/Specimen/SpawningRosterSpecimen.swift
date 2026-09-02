import ArgoEngine
import SwiftUI

/// The whole shell over a Project with nothing started in it, and a spawn that PUBLISHES.
///
/// Every other specimen hands the shell `.inert` actions, which is useless for a click: pressing
/// New Session against `.inert` would prove the control exists rather than that it starts anything.
///
/// It stands in for the Hub's own provisional row (#412) — the same shape, under a claim's id. The
/// PTY is left out: an E2E run must not start a real agent on the machine it is running on.
struct SpawningRosterSpecimen: View {
    /// The words the roster draws for a Session that has only just started — `AgentSpawn.title`'s,
    /// so a rename there shows up here as a failing walk.
    static let provisionalTitle = "New session"

    @State private var presentation = CockpitPresentation.emptyPreview
    @State private var navigation = CockpitNavigationModel()
    @State private var started = 0

    var body: some View {
        CockpitView(presentation: presentation, actions: actions)
            .environment(navigation)
    }

    private var actions: CockpitActions {
        var actions = CockpitActions(drive: InMemorySessionDriver())
        actions.sessions.spawn = publish
        return actions
    }

    /// A row on the roster and its id back, which is the whole of what the spawn path answers the
    /// shell with. Newest first, because that is the order the roster is in.
    private func publish() -> String {
        started += 1
        let session = CockpitPresentation.Session(
            id: "claim-\(started)",
            title: Self.provisionalTitle,
            access: .managed,
            status: .idle,
            chain: .init(
                program: .init(cli: .claude),
                span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(0)),
            ),
            work: .init(location: presentation.activeProject?.location),
        )
        presentation = CockpitPresentation(
            projects: presentation.projects,
            activeProjectID: presentation.activeProjectID,
            sessions: [session] + presentation.sessions,
            checkout: presentation.checkout,
            connection: presentation.connection,
        )
        return session.id
    }
}
