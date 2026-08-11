import SwiftUI

/// The whole shell over a Project with nothing started in it, and a spawn that PUBLISHES.
///
/// Every other specimen hands the shell `.inert` actions, which is right for a still render and
/// useless for a click: the toolbar's New Session button is only reachable by pressing it, and a
/// press against `.inert` would prove the control exists rather than that it starts anything.
///
/// What it stands in for is the Hub's own provisional row (#412) — the same shape, under an id
/// that is a claim's, titled the way `AgentSpawn` titles one before its CLI has written a record.
/// The PTY is the one part left out, deliberately: an E2E run must not start a real agent on the
/// machine it is running on, and everything this case is a harness FOR happens above the process.
struct SpawningRosterSpecimen: View {
    /// The words the roster draws for a Session that has only just started — `AgentSpawn.title`'s,
    /// so a rename there shows up here as a failing walk rather than as a fixture nobody re-read.
    static let provisionalTitle = "New session"

    @State private var presentation = CockpitPresentation.emptyPreview
    @State private var navigation = CockpitNavigationModel()
    @State private var started = 0

    var body: some View {
        CockpitView(presentation: presentation, actions: actions)
            .environment(navigation)
    }

    private var actions: CockpitActions {
        CockpitActions(
            refreshCheckout: {},
            retryConnection: {},
            selectProject: { _ in },
            addProject: {},
            locateProject: { _ in },
            revealProject: { _ in },
            removeProject: { _ in },
            openProjectPanel: { _ in },
            spawnSession: publish,
            setSessionArchived: { _, _ in },
            setSessionName: { _, _ in },
            handOffSession: { _, _ in nil },
            sendTurn: { _, _ in },
            decidePermission: { _, _, _ in },
            revokeStandingAllow: { _, _ in },
        )
    }

    /// A row on the roster and its id back, which is the whole of what the spawn path answers the
    /// shell with. Newest first, because that is the order the roster is in.
    private func publish() -> String {
        started += 1
        let session = CockpitPresentation.Session(
            id: "claim-\(started)",
            title: Self.provisionalTitle,
            model: nil,
            workspaceLocation: presentation.activeProject?.location,
            access: .managed,
            status: .idle,
            cli: .claude,
            lastSeenAtMs: CockpitPresentation.minutesAgo(0),
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
