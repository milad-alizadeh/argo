import ArgoEngine

/// The projection from Hub state to what the cockpit renders — the seam ADR-0005 draws between
/// the state and the view, on this side of the port. It lives here rather than in the app target
/// so every honesty derivation below is provable in a test.
public extension CockpitPresentation {
    /// The Projects and the annotations are the app's own state, passed in; everything below is
    /// the Hub's reading of the Project it is pointed at.
    ///
    /// The annotations arrive as a whole set rather than as a flag per Session because a Session
    /// the Hub is not reporting still has one — an archive is a decision about a chain id.
    @MainActor
    init(
        projects: [Project],
        activeProjectID: Project.ID?,
        hub: Hub,
        annotations: SessionAnnotations = .empty,
    ) {
        let sessions = hub.sessions.map { Session(observed: $0, annotations: annotations) }
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
    init(observed session: HubSession, annotations: SessionAnnotations) {
        self.init(
            id: session.id,
            title: session.title,
            model: session.model,
            workspaceLocation: session.cwd,
            access: Access(provenance: session.provenance),
            status: session.status,
            cli: session.cli,
            workspace: Workspace(observed: session),
            // No Work Item provider is connected in this build (#414 is the OAuth grant).
            issue: nil,
            lastSeenAtMs: session.lastSeenAtMs,
            startedAtMs: session.startedAtMs,
            spentTokens: session.spentTokens,
            cachedTokens: session.cachedTokens,
            subagentTokens: session.subagentTokens,
            contextTokens: session.contextTokens,
            handedOffTo: session.handedOffTo,
            // Read off the annotations by chain id and never off the record: the transcript has
            // no opinion about this, and a Session whose file just grew is still archived.
            isArchived: annotations.isArchived(session.id),
            // Beside the observed title rather than over it: the derived one is what Reset goes
            // back to (#502, story 20).
            explicitName: annotations.explicitName(session.id),
            permission: session.permission,
            standingAllows: session.standingAllows,
            expiredPermissions: session.expiredPermissions,
            events: session.events,
        )
    }
}

extension CockpitPresentation.Session.Workspace {
    /// The git context behind a Session, and `nil` where the transcript and the repository
    /// together said nothing about one — an empty Workspace is still a claim that there is one.
    ///
    /// git's own branch wins over the transcript's where there is one: the counts beside it read
    /// the folder as it is NOW, and a name from an hour-old record would put two moments on one
    /// line. The transcript's is the fallback.
    init?(observed session: HubSession) {
        guard session.branch != nil || session.workspace != nil else { return nil }
        self.init(
            kind: session.workspace?.kind,
            branch: session.workspace?.branch ?? session.branch,
            dirty: session.workspace?.dirty,
            unpushed: session.workspace?.unpushed,
        )
    }
}

extension CockpitPresentation.Session.Access {
    /// Access is what provenance IS, rather than a policy applied to it: Argo owns no PTY for a
    /// Session it did not spawn, and an orphaned one lost the PTY it had. One case each, so the
    /// shell can say which of the two it is looking at.
    init(provenance: SessionProvenance) {
        self = switch provenance {
        case .managed: .managed
        case .external: .external
        case .orphaned: .orphaned
        }
    }
}
