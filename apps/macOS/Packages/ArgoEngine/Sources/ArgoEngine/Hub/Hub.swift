import Foundation
import Observation

/// The process-lifetime, rebuildable join consumed by the app's views.
///
/// Its mutable state has two owners (#759): the watch below, and the readings beside it.
@MainActor
@Observable
public final class Hub {
    /// Which Project this Hub is on. The checkout read resolves it to the repository root, so a
    /// Hub pointed inside a repo settles on the repo.
    public private(set) var project: HubProject
    public private(set) var checkout = CheckoutProjection.Head.unavailable

    /// The tails, the join they feed, the sweep that moves them, and the Subagent files read
    /// beside them. Built lazily because its reconciliation hook reads this Hub.
    @ObservationIgnored lazy var watch: TranscriptWatch = {
        let watch = TranscriptWatch(engine: engine, discovery: discovery, readings: subagents)
        watch.onApplied = { [weak self] in await self?.didApply() }
        return watch
    }()

    /// The process table and git. Lazy for the reason above: the folders it asks git about are the
    /// ones on this Hub's roster, which is read back off these readings.
    @ObservationIgnored lazy var readings = WorldReadings(
        engine: engine,
        // The RESOLVED Project, which `refreshCheckout` settles on the repository root: the
        // worktree listing is a fact about a repository, and a launch path inside one would ask
        // git the same question from further in.
        repositoryURL: { [weak self] in self?.project.url },
        sessions: { [weak self] in
            self?.sessions.map { SessionActivity(cwd: $0.cwd, lastSeenAtMs: $0.lastSeenAtMs) } ?? []
        },
    )

    /// Each Subagent's own reading, published beside the roster rather than inside it, so a child's
    /// bytes reach no surface that does not draw one (#858). Read through `subagentReading(of:)`,
    /// which the cockpit asks only where a lane is actually drawn.
    let subagents = SubagentReadings()

    /// Everything Argo knows per claim: what the agent said, what its gate is holding, and the
    /// rung Argo put it on (#634). One key and one publish rule, where there were five of each.
    let claims = ClaimLedger()

    /// The folded roster, held for as long as every input behind it stands still. Not observed: it
    /// is what `sessions` ANSWERS with, and what a reader observes is the stamp's own inputs.
    @ObservationIgnored let roster = HubRosterMemo()

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

    /// The two session-drive adapters (ADR-0024), and the only ones: the Codex adapter holds its
    /// own thread table, so a second construction would be a second answer to which Sessions Argo
    /// can steer. `driver` composes over this, and `SessionChannel` reaches it directly (#749).
    ///
    /// Two constraints follow from it being held rather than composed per read. Lazy, because it
    /// reads this Hub and `delivery`. And it takes `permissions` by VALUE, so the companion channel
    /// must be open before anything reaches this — `init` opens it, and one opened later would find
    /// the gate here holding nothing.
    @ObservationIgnored lazy var adapters = makeAdapters()

    /// The rows for agents Argo has started whose CLI has not yet written a record. Observed, so a
    /// spawn reaches the roster in the same update that opened its PTY.
    var spawns: [SessionOwnership.ClaimID: AgentSpawn] = [:]

    /// The clock each spawn's `starting` wait runs on (#1245), one per claim. Held rather than
    /// fired and forgotten, because every way the wait ends but the clock itself has to cancel it —
    /// and because a suite driving `StartupPatience.immediate` needs the moment to await.
    ///
    /// Not observed: what it writes is on `spawns`, which is, and a clock in the stamp would move
    /// the roster for a task starting rather than for a fact changing.
    @ObservationIgnored var startupClocks: [SessionOwnership.ClaimID: Task<Void, Never>] = [:]

    /// Which Session handed its work to which — the ones this process made and the ones any Argo
    /// did, under one answer (#634).
    let handoff: HandoffLedger

    /// The rung a spawn opens on where its seed names none (#629). Read at the spawn rather than
    /// held as a value: another window may have picked since this one launched, and the file is the
    /// only place the two of them meet.
    @ObservationIgnored let modeStore: SessionModeStore

    /// The Model and Effort a spawn opens on (#1175). Read at the spawn for the reason the rung
    /// above is: the file is where two windows meet.
    @ObservationIgnored let runStore: SessionRunStore

    @ObservationIgnored let spawnServices: SpawnServices
    /// This Hub's own corner of the shared companion root: two Hubs mint the same claim ids, so
    /// the corner is what keeps their socket paths apart (#987).
    @ObservationIgnored let companionScope: CompanionScope
    @ObservationIgnored var companion: CompanionChannel?
    @ObservationIgnored var permissions: PermissionChannel?

    @ObservationIgnored let discovery: SessionDiscovery
    @ObservationIgnored let engine: Engine
    /// What the Hub was last pointed with, held so a retry needs nothing re-supplied.
    @ObservationIgnored private var configuration: LaunchConfiguration

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
        self.modeStore = SessionModeStore(fileURL: spawnServices.files.modeFileURL)
        self.runStore = SessionRunStore(fileURL: spawnServices.files.runFileURL)
        // Read at construction: the roster is published before anything is swept, and a chain
        // loaded a moment later would blank the link on the first reading of a Session that has
        // one.
        self.handoff = HandoffLedger(
            store: HandoffChainStore(fileURL: spawnServices.files.chainFileURL),
        )
        self.ownership = SessionOwnership(
            ledgerStore: SessionOwnershipLedgerStore(fileURL: spawnServices.files.ownershipFileURL),
        )
        self.companionScope = CompanionScope(under: spawnServices.companionRoot)
        openCompanionChannel()
    }

    /// Point the Hub at a Project. Everything the previous one established is cancelled and
    /// dropped first, so no tail of it survives and no event of it reaches the rebuilt roster.
    ///
    /// Returns once the tails have started, not once they end — a live transcript has no end.
    public func connect(to configuration: LaunchConfiguration) async {
        await watch.whileConnecting {
            await point(at: configuration)
        }
    }

    /// Point again at the configuration the Hub is already on — what a retry after a failed
    /// connection IS.
    public func reconnect() async {
        await connect(to: configuration)
    }

    /// Drop the whole Project: the sweep, every tail, the join they fed, and the checkout and
    /// world readings taken alongside them.
    public func disconnect() async {
        await watch.stopSweeping()
        await readings.stop()
        // Retained before the tails are torn down, which is what empties the join.
        watch.retain(for: project.url.path)
        await watch.stopAll()
        checkout = .unavailable
    }

    /// Re-read the checkout of the Project this Hub is on. The read resolves the repository root as
    /// well, so "which Project" moves from the folder the caller named to the repo git says it is
    /// in.
    public func refreshCheckout() async {
        let projection = await engine.checkout(at: project.url)
        project = HubProject(url: projection.repositoryURL)
        checkout = projection.head
    }

    /// Start tailing one transcript, as a Session the roster has not seen before.
    public func startObserving(_ observation: TranscriptObservation) async {
        await watch.startObserving(observation)
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    public func stopObserving(transcriptID: String) async {
        await watch.stopObserving(transcriptID: transcriptID)
    }

    /// Stop one tail, keeping in the roster the Session it read.
    public func pauseObserving(transcriptID: String) async {
        await watch.pauseObserving(transcriptID: transcriptID)
    }

    func refreshWorkingSet() async {
        await watch.refreshWorkingSet()
    }

    func refreshLiveness() async {
        await readings.refreshLiveness()
    }

    func refreshWorkspaces() async {
        await readings.refreshWorkspaces()
    }

    /// With no transcript named, the Sessions are the ones discovery finds on disk and the working
    /// set keeps moving while the app runs. A named transcript is the render harness's explicit
    /// override, and nothing is swept for.
    private func point(at configuration: LaunchConfiguration) async {
        await disconnect()
        // A remembered plugin failure would be a claim about a spawn another Project never made.
        if configuration.projectURL != self.configuration.projectURL {
            companion?.forgetRefusal()
        }
        self.configuration = configuration
        project = HubProject(url: configuration.projectURL)
        await refreshCheckout()
        // Taken against the RESOLVED Project, which is the key it was retained under.
        watch.restore(for: project.url.path)
        await readings.begin()
        guard !configuration.transcriptURLs.isEmpty else {
            // The sweep runs against the RESOLVED Project, which `refreshCheckout` has just read:
            // scoping to the launch path would hide every Session working elsewhere in the repo.
            await watch.beginSweeping(in: project.url)
            return
        }
        await watch.observeNamed(configuration.transcriptURLs)
    }
}
