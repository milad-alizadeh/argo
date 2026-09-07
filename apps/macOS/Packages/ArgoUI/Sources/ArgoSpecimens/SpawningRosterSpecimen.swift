import ArgoEngine
import ArgoUI
import SwiftUI

/// The whole shell over a Project, and a spawn that PUBLISHES.
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

    /// The roster `crowdedSpawningRoster` starts from. A hundred, because #1562's reading is
    /// about four times its roster and a handful of rows cannot tell a quadrupled tree from an
    /// ordinary one. Named so the entry and `SessionRosterSpecimenTests` mean the same rows.
    static let crowd = (0 ..< 100).map { settled(at: $0) }

    @State private var presentation: CockpitPresentation
    @State private var navigation = CockpitNavigationModel()
    @State private var started = 0

    init(seeded: [CockpitPresentation.Session] = []) {
        let empty = CockpitPresentation.emptyPreview
        _presentation = State(initialValue: CockpitPresentation(
            projects: empty.projects,
            activeProjectID: empty.activeProjectID,
            sessions: seeded,
            connection: empty.connection,
        ))
    }

    /// One of the Sessions the roster is already holding. Titles differ per row so the naming pass
    /// does the work it does on a real roster: a hundred rows sharing one title fold into one
    /// (#1073), and a folded roster is not the tree that was counted.
    private static func settled(at index: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "settled-\(index)",
            title: "/implement \(1000 + index)",
            access: .managed,
            status: .idle,
            chain: .init(
                program: .init(cli: .claude),
                span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(index + 1)),
            ),
            work: .init(location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(index)"),
        )
    }

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
            // What the Hub's own provisional row reads: Argo has started the PTY and heard nothing
            // off it yet (#587).
            status: .starting,
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
            connection: presentation.connection,
        )
        return session.id
    }
}
