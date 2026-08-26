import Foundation
import Observation

/// The process-lifetime, rebuildable join consumed by the app's views.
@MainActor
@Observable
public final class Hub {
    /// Which Project this Hub is on. The checkout read resolves it to the repository root, so a
    /// Hub pointed inside a repo settles on the repo.
    public private(set) var project: HubProject
    public private(set) var checkout = CheckoutProjection.Head.unavailable

    /// Everything Argo knows per claim: what the agent said, what its gate is holding, and the
    /// rung Argo put it on (#634). One key and one publish rule, where there were five of each.
    let claims = ClaimLedger()

    /// Which Sessions this Argo process owns a PTY for, and — through its ledger — which ones any
    /// Argo ever did. Empty of claims until something spawns or resumes one.
    public let ownership: SessionOwnership

    /// The PTYs behind those claims. Held for the life of this process, and ended with it.
    let terminals = AgentTerminals()

    /// The Turns typed at those PTYs that the CLI has not yet answered for (#682). Built lazily
    /// because its three closures read this Hub, and stored because a watch has to outlive the
    /// `driver` value that started it — `driver` is composed fresh on every read.
    ///
    /// PTYs and not threads: the Return it watches for is a keystroke, and the Codex adapter below
    /// speaks JSON-RPC where a Turn is a request that was either accepted or refused.
    @ObservationIgnored lazy var delivery = makeDelivery()

    /// The Codex threads behind the claims that have one. Empty on a Hub that has spawned no
    /// `codex`, which is also what tells the drive port which adapter a Session takes.
    let codex = CodexThreads()

    /// What starts a `codex app-server`. Pipes rather than a PTY, and engine-owned rather than
    /// injected, because it links nothing the app has to supply (`CodexProcessHost`). The seam is
    /// still there for a suite that must not start a real one.
    @ObservationIgnored let codexHost: AgentProcessHost

    /// The rows for agents Argo has started whose CLI has not yet written a record. Observed, so a
    /// spawn reaches the roster in the same update that opened its PTY.
    var spawns: [SessionOwnership.ClaimID: AgentSpawn] = [:]

    /// Which Session handed its work to which — the ones this process made and the ones any Argo
    /// did, under one answer (#634).
    let handoff: HandoffLedger

    /// The rung a spawn opens on where its seed names none (#629). Read at the spawn rather than
    /// held as a value: another window may have picked since this one launched, and the file is the
    /// only place the two of them meet.
    @ObservationIgnored let modeStore: SessionModeStore

    @ObservationIgnored let spawnServices: SpawnServices
    @ObservationIgnored var companion: CompanionChannel?
    @ObservationIgnored var permissions: PermissionChannel?

    /// The working directories a live CLI was running in when the process table was last read, and
    /// when that was. Absent until a read has happened, so an unread liveness degrades down to
    /// quiet rather than up to a running Argo never saw. Observed rather than ignored: a Session
    /// going quiet has to reach the roster, and the roster is read off these two.
    var liveCwds: Set<String> = []
    var livenessReadAtMs: Int?
    /// What git last said about each Session's working folder, keyed by cwd. Observed: the roster
    /// is read off this.
    var workspaces: [String: WorkspaceProjection] = [:]
    @ObservationIgnored var livenessPolling: Task<Void, Never>?

    var join = HubJoin()
    /// The rosters of the Projects this Hub has been pointed at, kept across a switch. The sweep
    /// still re-runs and the tails still re-read on re-entry.
    @ObservationIgnored private var retainedJoins = HubJoinCache()
    /// The running tail per transcript id. Observed rather than ignored, because `observations`
    /// and `connection` are read off it — in `Hub+Roster.swift`, which is why the three fields here
    /// are internal rather than private.
    var tails: [String: Task<Void, Never>] = [:]
    /// The running tail per Subagent file — see `Hub+Subagents.swift`. Beside the tails above and
    /// not among them: a Subagent is not in the working set and has no row of its own.
    var subagentTails: [SubagentTail: Task<Void, Never>] = [:]
    var failureMessage: String?
    var isConnecting = false
    @ObservationIgnored let discovery: SessionDiscovery
    @ObservationIgnored let engine: Engine
    /// What the Hub was last pointed with, held so a retry needs nothing re-supplied.
    @ObservationIgnored private var configuration: LaunchConfiguration
    /// The Project the sweep is running against, absent while the Hub is disconnected or reading a
    /// named transcript.
    @ObservationIgnored var sweepProjectURL: URL?
    @ObservationIgnored var sweeping: Task<Void, Never>?

    func isObserving(transcriptID: String) -> Bool {
        tails[transcriptID] != nil
    }

    public init(
        projectURL: URL,
        engine: Engine = Engine(),
        discovery: SessionDiscovery = SessionDiscovery(),
        spawnServices: SpawnServices = .none,
    ) {
        self.project = HubProject(url: projectURL)
        self.configuration = LaunchConfiguration(projectURL: projectURL, transcriptURLs: [])
        self.engine = engine
        self.discovery = discovery
        self.spawnServices = spawnServices
        self.codexHost = spawnServices.codexHost ?? CodexProcessHost()
        self.modeStore = SessionModeStore(fileURL: spawnServices.modeFileURL)
        // Read at construction: the roster is published before anything is swept, and a chain
        // loaded a moment later would blank the link on the first reading of a Session that has
        // one.
        self.handoff = HandoffLedger(
            store: HandoffChainStore(fileURL: spawnServices.chainFileURL),
        )
        self.ownership = SessionOwnership(
            ledgerStore: SessionOwnershipLedgerStore(fileURL: spawnServices.ownershipFileURL),
        )
        openCompanionChannel()
    }

    /// Point the Hub at a Project. Everything the previous one established is cancelled and
    /// dropped first, so no tail of it survives and no event of it reaches the rebuilt roster.
    ///
    /// With no transcript named, the Sessions are the ones discovery finds on disk and the working
    /// set keeps moving while the app runs. A named transcript is the render harness's explicit
    /// override, and nothing is swept for.
    ///
    /// Returns once the tails have started, not once they end — a live transcript has no end.
    public func connect(to configuration: LaunchConfiguration) async {
        isConnecting = true
        defer { isConnecting = false }
        await disconnect()
        // A remembered plugin failure would be a claim about a spawn another Project never made.
        if configuration.projectURL != self.configuration.projectURL {
            companion?.forgetRefusal()
        }
        self.configuration = configuration
        project = HubProject(url: configuration.projectURL)
        await refreshCheckout()
        // Taken against the RESOLVED Project, which is the key it was retained under.
        join = retainedJoins.take(for: project.url.path) ?? HubJoin()
        await beginLiveness()
        guard !configuration.transcriptURLs.isEmpty else {
            // The sweep runs against the RESOLVED Project, which `refreshCheckout` has just read:
            // scoping to the launch path would hide every Session working elsewhere in the repo.
            await beginDiscovery()
            return
        }
        await observeNamed(configuration.transcriptURLs)
    }

    /// Point again at the configuration the Hub is already on — what a retry after a failed
    /// connection IS.
    public func reconnect() async {
        await connect(to: configuration)
    }

    /// Drop the whole Project: the sweep, every tail, the join they fed, and the checkout and
    /// failure read alongside them.
    public func disconnect() async {
        await stopSweeping()
        await stopLiveness()
        // Retained before the tails are torn down, which is what empties the join.
        retainedJoins.retain(join, for: project.url.path)
        await stopObservingAll()
        checkout = .unavailable
        failureMessage = nil
    }

    /// The whole named set is validated before any tail starts, and one unreadable name fails the
    /// connection rather than yielding a smaller roster. Discovery's own opens are skipped
    /// instead — see `refreshWorkingSet`.
    private func observeNamed(_ urls: [URL]) async {
        do {
            for observation in try engine.observeTranscripts(at: urls) {
                await startObserving(observation)
            }
        } catch {
            await stopObservingAll()
            failureMessage = "Transcript unavailable"
        }
    }

    /// Start tailing one transcript, as a Session the roster has not seen before. It joins the
    /// working set immediately — the ROSTER once the file has been read.
    public func startObserving(_ observation: TranscriptObservation) async {
        await stopObserving(transcriptID: observation.id)
        await startTailing(observation)
    }

    /// Start tailing one transcript, keeping whatever row the roster already holds for it.
    ///
    /// The join resolves a record's owner by which transcript claimed it FIRST, so re-adding a
    /// paused resume-chain root would put it behind its own continuation and re-attribute the
    /// records it authored. A tail re-reads from the start of the file.
    func startTailing(_ observation: TranscriptObservation) async {
        await pauseObserving(transcriptID: observation.id)
        join.add(observation)
        // A connection reading `failed` over a live source is a stale claim.
        failureMessage = nil
        tails[observation.id] = Task { [weak self] in await self?.drain(observation) }
        // Whatever the fan-out has written SO FAR. The rest arrives with the sweep, which is what
        // sees the file for a delegation handed over after this moment.
        refreshSubagents(of: observation.id, beside: observation.sourceURL)
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    public func stopObserving(transcriptID: String) async {
        join.remove(transcriptID: transcriptID)
        await pauseObserving(transcriptID: transcriptID)
    }

    /// Stop one tail, keeping in the roster the Session it read. What discovery calls when a
    /// transcript ages out of the working set.
    ///
    /// Awaits the cancelled task, so a stopped tail is provably over before this returns — which
    /// keeps a straggling event from landing under an id re-registered in the meantime.
    public func pauseObserving(transcriptID: String) async {
        await stopTailingSubagents(of: transcriptID)
        guard let task = tails.removeValue(forKey: transcriptID) else { return }
        task.cancel()
        await task.value
    }

    /// Re-read the checkout of the Project this Hub is on. The read resolves the repository root as
    /// well, so "which Project" moves from the folder the caller named to the repo git says it is
    /// in.
    public func refreshCheckout() async {
        let projection = await engine.checkout(at: project.url)
        project = HubProject(url: projection.repositoryURL)
        checkout = projection.head
    }

    /// The join is emptied before anything is cancelled, so a tail that gets one more turn while
    /// tearing down finds no transcript to apply against. Cancelling the whole set before awaiting
    /// any of it keeps a slow teardown from serialising behind the one in front of it.
    private func stopObservingAll() async {
        await stopTailingAllSubagents()
        let stopped = Array(tails.values)
        tails = [:]
        join = HubJoin()
        for task in stopped {
            task.cancel()
        }
        for task in stopped {
            await task.value
        }
    }

    private func drain(_ observation: TranscriptObservation) async {
        for await events in observation.events {
            join.apply(events, to: observation.id)
            // After the join, never before: reconciliation retires a spawned Session's own row, and
            // it may only do that once the observed row it is standing in for is published.
            reconcileSpawns()
        }
        // A tail that ended without delivering a backfill — an unopenable file, or one stopped
        // mid-read — still has to settle, or the roster waits on a transcript that never speaks.
        join.settle(transcriptID: observation.id)
        // Clearing by id is safe: every path that re-registers an id awaits the previous tail to
        // completion first, so no later tail can be holding the key by the time this runs.
        tails.removeValue(forKey: observation.id)
    }
}
