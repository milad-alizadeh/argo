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
    init(pointing: CockpitPointing, hub: Hub, readings: Readings = .none) {
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
            readings: readings,
        )
    }

    /// The Projects and the annotations are the app's own state, passed in; everything below is
    /// the Hub's reading of the Project it is pointed at.
    ///
    /// The readings arrive as a whole set rather than as a flag per Session because a Session the
    /// Hub is not reporting still has annotations — an archive is a decision about a chain id.
    @MainActor
    init(
        projects: [Project],
        activeProjectID: Project.ID?,
        hub: Hub,
        readings: Readings = .none,
    ) {
        let sessions = hub.sessions.map { Session(observed: $0, readings: readings) }
        self.init(
            projects: Self.counted(projects, activeProjectID: activeProjectID, in: sessions),
            activeProjectID: activeProjectID,
            sessions: sessions,
            checkout: hub.checkout,
            connection: hub.connection,
        )
        // After the init and not through it — see the property.
        self.subagents = readings.subagents
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
    /// not-projected: driveStatus — the same input again, at DIRECT, where the CLI's own protocol
    ///   reported it (#683).
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
    /// not-projected: transcriptExtent — how much of the record was read. It reaches no surface
    ///   because nothing below the shell has to know: every fact a bounded reading cannot state is
    ///   withheld by the engine itself (`HubSession+Spend`), which is degrade-down at the source
    ///   rather than a flag each surface would have to remember to ask about.
    ///
    /// Edge 5 also requires each fact below to land on the slot of its own name, unless a
    /// `renamed:` line here says otherwise (ADR-0027, amended by #755).
    ///
    /// renamed: location <- cwd — "Names are words, not abbreviations" (rules/code-style.md).
    /// renamed: claimed <- ticket — the slot sits beside a title reading also about the ticket, and
    /// one of the two has to say WHICH fact about it (#881).
    init(observed session: HubSession, readings: CockpitPresentation.Readings) {
        // Read once and handed to both: the Workspace draws the branch and the Ticket link joins
        // on it, and two readings of one fact would let the two disagree.
        let workspace = Workspace(observed: session)
        self.init(
            id: session.id,
            title: session.title,
            access: Access(provenance: session.provenance),
            status: session.status,
            chain: Chain(
                cli: session.cli,
                model: session.model,
                startedAtMs: session.startedAtMs,
                lastSeenAtMs: session.lastSeenAtMs,
                handedOffTo: session.handedOffTo,
                companionChannel: session.companionChannel,
            ),
            work: Work(
                location: session.cwd,
                workspace: workspace,
                ticket: TicketLinkReading(
                    link: Issue(
                        claimed: session.ticket,
                        branch: workspace?.branch,
                        location: session.cwd,
                        title: readings.annotations.ticket(session.id),
                    ),
                    isProviderBound: readings.isTicketProviderBound,
                ),
            ),
            spend: Spend(
                spentTokens: session.spentTokens,
                cachedTokens: session.cachedTokens,
                subagentTokens: session.subagentTokens,
                contextTokens: session.contextTokens,
            ),
            autonomy: Autonomy(
                // The Hub's own reading, carried whole rather than reduced to a rung: the `≈` and
                // the CLI's word are what the composer renders, and a rung alone cannot say either.
                mode: session.mode,
                modeDidNotTake: session.modeDidNotTake,
                permission: session.permission,
                ask: session.ask,
                standingAllows: session.standingAllows,
                expiredPermissions: session.expiredPermissions,
            ),
            annotations: Annotations(
                // Read off the annotations by chain id and never off the record: the transcript has
                // no opinion about this, and a Session whose file just grew is still archived.
                isArchived: readings.annotations.isArchived(session.id),
                // Beside the observed title rather than over it: the derived one is what Reset goes
                // back to (#502, story 20).
                explicitName: readings.annotations.explicitName(session.id),
            ),
            transcript: Transcript(observed: session),
        )
    }
}

extension CockpitPresentation.Session.Transcript {
    /// What the transcript said, with the ENGINE's own stamp for it rather than one derived here:
    /// the stamp counts writes as well as lengths, and nothing on this side of the seam can see a
    /// write. It is what the cockpit compares two readings of a stream by — see `Stream`.
    init(observed session: HubSession) {
        self.init(
            events: session.events,
            transcriptStamp: session.transcriptStamp,
            lostTurn: session.lostTurn,
        )
    }
}

extension CockpitPresentation.Session.Issue {
    /// The Ticket this Session's git context names, and `nil` where it names none (#745).
    ///
    /// Two readings, and the DIRECT one wins: `claimed` is the ticket Argo was told to start this
    /// Session on (#872), and the branch is the DERIVED convention `docs/agents/worktrees.md` fixes
    /// (#745). The title came from outside Argo either way.
    ///
    /// The claim is asked first because it is the earlier and the firmer of the two: a Session
    /// started on a ticket is claimed before anything has cut a branch to read the number off, and
    /// a Session whose branch was later renamed is still the one that was started for it.
    ///
    /// Each link carries the tier that produced it, so the two are never rendered as each other.
    ///
    /// Three ways to have no link, and all three draw nothing rather than a guess: no claim, a
    /// branch carrying no `#<N>`, and — once the host has been asked — a number it has nothing
    /// behind. A number nobody has asked about yet keeps its link and carries no title, which
    /// `SessionTitle` drops back to the derived name.
    init?(claimed: Int?, branch: String?, location: String?, title: TicketTitleReading?) {
        // The claim is asked first and is never dropped by the host: Argo was TOLD this number at
        // the spawn, so an `absent` lookup says the host could not name it, not that the Session is
        // on nothing. Only the DERIVED reading — a number guessed off a branch — needs the host to
        // confirm it, because there a misread `#<N>` and a real ticket look identical.
        if let claimed {
            self.init(number: claimed, title: title?.title, tier: .direct)
            return
        }
        guard let number = Self.derived(branch: branch, location: location, title: title)
        else { return nil }
        self.init(number: number, title: title?.title, tier: .derived)
    }

    /// The number a git context names, once the host has had its say. `nil` where the branch names
    /// none, and where it names one the host answered has nothing behind — a branch naming a ticket
    /// that does not exist (`TicketTitleReading.absent`).
    private static func derived(
        branch: String?, location: String?, title: TicketTitleReading?,
    )
        -> Int? {
        guard title != .absent else { return nil }
        return TicketLink.number(branch: branch, workspaceLocation: location)
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
            // Unpushed is the header's word for the ahead half of the divergence; the behind half
            // has no mark on this surface, so it stops at the engine.
            unpushed: session.workspace?.divergence?.ahead,
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
