import ArgoEngine

/// The projection from Hub state to what the cockpit renders — the seam ADR-0005 draws between
/// the state and the view, on this side of the port.
///
/// It lives here rather than in the app target because a projection nothing can call is a
/// projection nothing checks: every derivation below is a claim about honesty (what access a
/// Session grants, what its status can be said to be), and those are exactly the claims that have
/// to be provable in a test rather than asserted in `@main`.
public extension CockpitPresentation {
    /// The Projects and the annotations are passed in rather than read here: both are the app's
    /// own state — one registered, one asserted by hand — while everything below is the Hub's
    /// reading of the Project it is pointed at.
    ///
    /// The annotations arrive as a whole set rather than as a flag per Session because a Session
    /// the Hub is not reporting still has one: an archive is a decision about a chain id, and it
    /// outlives every observation of it.
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
            // No Work Item provider is connected in this build (#414 is the OAuth grant), so
            // there is no link to read and nothing to render. Absent, rather than a link to a
            // provider that does not exist.
            issue: nil,
            lastSeenAtMs: session.lastSeenAtMs,
            startedAtMs: session.startedAtMs,
            totalTokens: session.totalTokens,
            subagentTokens: session.subagentTokens,
            contextTokens: session.contextTokens,
            // Read off the annotations by chain id and never off the record: the transcript has
            // no opinion about this, and a Session whose file just grew is still archived.
            isArchived: annotations.isArchived(session.id),
            events: session.events,
        )
    }
}

extension CockpitPresentation.Session.Workspace {
    /// The git context behind a Session, and `nil` where the transcript and the repository
    /// together said nothing about one — an empty Workspace is still a claim that there is one.
    ///
    /// git's own branch wins over the transcript's where there is one: the counts beside it are
    /// a reading of the folder as it is NOW, and a name from a record written an hour ago would
    /// put two moments on one line. The transcript's is the fallback, for a Session whose folder
    /// has not been read yet or is no longer there.
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
    /// shell can say which of those two it is looking at rather than only that it cannot steer.
    init(provenance: SessionProvenance) {
        self = switch provenance {
        case .managed: .managed
        case .external: .external
        case .orphaned: .orphaned
        }
    }
}
