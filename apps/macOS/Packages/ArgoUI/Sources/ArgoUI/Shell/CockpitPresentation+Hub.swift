import ArgoEngine

/// The projection from Hub state to what the cockpit renders — the seam ADR-0005 draws between
/// the state and the view, on this side of the port.
///
/// It lives here rather than in the app target because a projection nothing can call is a
/// projection nothing checks: every derivation below is a claim about honesty (what access a
/// Session grants, what its status can be said to be), and those are exactly the claims that have
/// to be provable in a test rather than asserted in `@main`.
public extension CockpitPresentation {
    /// The Projects are passed in rather than read here: the registered set is the app's own state,
    /// while everything below is the Hub's reading of the one it is pointed at.
    @MainActor
    init(projects: [Project], activeProjectID: Project.ID?, hub: Hub) {
        self.init(
            projects: projects,
            activeProjectID: activeProjectID,
            sessions: hub.sessions.map(Session.init(observed:)),
            checkout: hub.checkout,
            connection: hub.connection,
        )
    }
}

extension CockpitPresentation.Session {
    init(observed session: HubSession) {
        self.init(
            id: session.id,
            title: session.title,
            model: session.model,
            workspaceLocation: session.cwd,
            branch: session.branch,
            access: Access(provenance: session.provenance),
            status: session.status,
        )
    }
}

extension CockpitPresentation.Session.Access {
    /// Read-only is what everything but `managed` IS, rather than a policy applied to it: Argo
    /// owns no PTY for a Session it did not spawn, and an orphaned one lost the PTY it had.
    init(provenance: SessionProvenance) {
        self = switch provenance {
        case .managed: .managed
        case .external, .orphaned: .readOnly
        }
    }
}
