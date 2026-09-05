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
        case .running, .permission, .asking, .idle, .stopped, .starting, .unknown: true
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
    /// renamed: location <- cwd — "Names are words, not abbreviations" (rules/house.md).
    /// renamed: claimedAt <- ticket — the slot sits beside a title reading also about the ticket,
    /// and beside the reader's own pin, which is a second DIRECT number about it (#1092): the name
    /// has to say WHICH fact and WHEN it was taken (#881). `Issue.directNumber` ranks the two.
    /// renamed: claim <- readyToShip — `Work.Delivery`'s init (#1335) takes the raw CONVENTION
    /// claim so it can resolve it against the pull request beside it; the projected
    /// `Session.readyToShip` is the already-resolved Bool that comes out.
    init(observed session: HubSession, readings: CockpitPresentation.Readings) {
        // Read once and handed to both: the Workspace draws the branch and the Ticket link joins
        // on it, and two readings of one fact would let the two disagree.
        let workspace = Workspace(observed: session)
        let pullRequest = workspace?.branch.flatMap(readings.pullRequest(forBranch:))
        self.init(
            id: session.id,
            title: session.title,
            access: Access(provenance: session.provenance),
            status: session.status,
            chain: Chain(observed: session),
            work: Work(
                location: session.cwd,
                workspace: workspace,
                ticket: TicketLinkReading(
                    link: Issue(
                        claimed: Issue.directNumber(
                            pinnedTo: readings.annotations.pinnedTicket(session.id),
                            claimedAt: session.ticket,
                        ),
                        branch: workspace?.branch,
                        location: session.cwd,
                        title: readings.annotations.ticket(session.id),
                    ),
                    isProviderBound: readings.isTicketProviderBound,
                ),
                delivery: .init(pullRequest: pullRequest, claim: session.readyToShip),
            ),
            spend: Spend(
                spentTokens: session.spentTokens, cachedTokens: session.cachedTokens,
                subagentTokens: session.subagentTokens, context: session.context,
            ),
            autonomy: Autonomy(
                // The Hub's own reading, carried whole rather than reduced to a rung: the `≈` and
                // the CLI's word are what the composer renders, and a rung alone cannot say either.
                mode: session.mode,
                modeDidNotTake: session.modeDidNotTake,
                blocked: Autonomy.Blocked(
                    permission: session.permission, ask: session.ask,
                    companionAsk: session.companionAsk,
                ),
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
                // What the reader may take back — the link above already carries what they DID.
                pinnedTicket: readings.annotations.pinnedTicket(session.id),
            ),
            transcript: Transcript(observed: session),
        )
    }
}

extension CockpitPresentation.Session.Chain {
    /// The resume chain behind a Session: what runs it, the three moments it is dated by, what it
    /// handed to, and whether Argo's own channel to it is up. Assembled here rather than inline
    /// above for the reason `Workspace` and `Transcript` are — the Session's own init reads one
    /// value per reading, and every one of them is built from the Session it came off.
    ///
    /// renamed: quietAtMs <- startedQuietlyAtMs — grouped under `Startup` beside `resuming`, which
    /// names the same wait (#1328).
    init(observed session: HubSession) {
        self.init(
            program: Program(observed: session),
            span: Span(
                startedAtMs: session.startedAtMs,
                lastSeenAtMs: session.lastSeenAtMs,
                startup: Startup(quietAtMs: session.startedQuietlyAtMs, resuming: session.resuming),
                settledWaits: session.settledWaits,
            ),
            handedOffTo: session.handedOffTo,
            companionChannel: session.companionChannel,
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
            hasUnansweredTurn: session.hasUnansweredTurn,
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

/// What is running the chain, read off the Hub's own reading of it.
///
/// Its own initializer rather than four arguments at the one call site: all four are read off the
/// same records at the same moment, and grouping them is what `Program` exists for (ADR-0027).
extension CockpitPresentation.Session.Chain.Program {
    init(observed session: HubSession) {
        self.init(
            cli: session.cli, model: session.model,
            effort: session.effort, entry: session.entry,
        )
    }
}

/// The shipping Subagent reader, assembled from the Hub.
///
/// Here rather than beside `FeedAgentReader` because this is the one file that may name the Hub
/// (ADR-0005), and here rather than at the app target's call site because WHICH of the Hub's calls
/// a reader is made of is not the app target's knowledge — when the second one arrived it was the
/// app target that had to be edited for it (#1269).
public extension FeedAgentReader {
    static func reading(_ hub: Hub) -> FeedAgentReader {
        FeedAgentReader(
            asking: hub,
            read: hub.subagentReading(of:),
            grewAtMs: hub.subagentGrewAtMs(of:),
        )
    }
}
