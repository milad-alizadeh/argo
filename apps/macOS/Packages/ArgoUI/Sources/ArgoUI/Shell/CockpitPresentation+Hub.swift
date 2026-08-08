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
        let sessions = hub.sessions.map(Session.init(observed:))
        self.init(
            projects: Self.counted(projects, activeProjectID: activeProjectID, in: sessions),
            activeProjectID: activeProjectID,
            sessions: sessions,
            checkout: hub.checkout,
            connection: hub.connection,
        )
    }

    /// The live-session count is the Hub's roster, and the Hub observes ONE Project. Every other
    /// Project keeps the absent count it arrived with rather than a zero: nothing has looked there,
    /// and "no Sessions" is a different claim from "not observed".
    private static func counted(
        _ projects: [Project],
        activeProjectID: Project.ID?,
        in sessions: [Session],
    )
        -> [Project] {
        let live = sessions.count(where: \.isLive)
        return projects.map {
            $0.id == activeProjectID ? $0.counting(liveSessions: live) : $0
        }
    }
}

extension CockpitPresentation.Session {
    /// A Session there is still something to go and look at. `ended` is the one status that is
    /// over; `unknown` is not — nothing observed is not observed to have finished.
    var isLive: Bool {
        switch status {
        case .running, .permission, .asking, .idle, .stopped, .unknown: true
        case .ended: false
        }
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
            events: session.events,
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
