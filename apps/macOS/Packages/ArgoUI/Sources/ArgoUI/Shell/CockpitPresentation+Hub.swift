import ArgoEngine

/// The projection from Hub state to what the cockpit renders — the seam ADR-0005 draws between
/// the state and the view, on this side of the port. It lives here rather than in the app target
/// so every honesty derivation below is provable in a test.
public extension CockpitPresentation {
    /// Where the window points, drawn as the strip. The registered set, and — on a launch pointed
    /// at a folder nobody registered — that folder at the HEAD of it: `--project` and a bare launch
    /// both land there, and a strip that drew only the registry would leave the roster on screen
    /// belonging to no mark at all.
    ///
    /// The unregistered mark stays for the window's life, not only while it is active: it is the
    /// only way back to where the process was pointed.
    @MainActor
    init(pointing: CockpitPointing, hub: Hub, annotations: SessionAnnotations = .empty) {
        let registered = pointing.registry.projects.map {
            Project(id: $0.id, name: $0.name, location: $0.path, isReachable: $0.isReachable)
        }
        var projects = registered
        if case let .unregistered(url)? = pointing.launchOrigin {
            projects.insert(
                Project(
                    id: url.path,
                    name: HubProject(url: url).name,
                    location: url.path,
                    isRegistered: false,
                ),
                at: 0,
            )
        }
        self.init(
            projects: projects,
            activeProjectID: pointing.launch.id,
            hub: hub,
            annotations: annotations,
        )
    }

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
    /// The engine facts this projection deliberately drops — the reason the cockpit restates
    /// `HubSession` instead of holding one (ADR-0027). Every other public fact on `HubSession`
    /// must appear as `session.<name>` below, and `swift-boundaries.sh` edge 5 fails the build
    /// when a new one appears in neither place.
    ///
    /// Most of them are the raw INPUTS to a derivation the cockpit takes the result of. Handing a
    /// view the inputs invites a second reading of a fact the Hub has already read.
    ///
    /// not-projected: liveness — an input to the status fold; `status` below is its result.
    /// not-projected: convention — the same input at the CONVENTION tier.
    /// not-projected: signals — the tuple that fold reads, and nothing else.
    /// not-projected: statusReading — carries the honesty tier beside the status. The tier is the
    ///   Hub's own bookkeeping, and no surface below the shell renders it.
    /// not-projected: modeSet — an input to `mode`, which lands below already reconciled.
    /// not-projected: lastActivityAtMs — one half of `lastSeenAtMs`, which lands below.
    /// not-projected: sourceURL — where the record sits on disk. A path, not a fact about a
    ///   Session, and the feed reads events rather than files.
    /// not-projected: headLeafUUID — how the chain is stitched, which is the Hub's business.
    /// not-projected: hasAgentActivity — the roster admission test, already applied upstream: a
    ///   Session that fails it never reaches this projection at all.
    /// not-projected: isQueued — the other half of that same admission test.
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
            // The Hub's own reading, carried whole rather than reduced to a rung: the `≈` and the
            // CLI's word are what the composer renders, and a rung alone cannot say either.
            mode: session.mode,
            modeDidNotTake: session.modeDidNotTake,
            lostTurn: session.lostTurn,
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
