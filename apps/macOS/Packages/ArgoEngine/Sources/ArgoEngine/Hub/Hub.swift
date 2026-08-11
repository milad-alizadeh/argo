import Foundation
import Observation

/// The process-lifetime, rebuildable join consumed by the app's views.
///
/// The tails are owned here rather than by the caller, because both things that move the working
/// set — discovery adding and dropping one transcript, and a Project switch dropping all of them —
/// have to stop a tail without ending the process.
///
/// The engine and the configuration it was pointed with are held for the same reason. A sweep an
/// hour after `connect` and a refresh after a Project switch both need them, and a caller asked to
/// re-supply either can supply a different answer from the one the Hub is actually on.
@MainActor
@Observable
public final class Hub {
    /// Which Project this Hub is on — the single answer. `connect` points it and the checkout read
    /// resolves it to the repository root, so a Hub pointed inside a repo settles on the repo.
    public private(set) var project: HubProject
    public private(set) var checkout = CheckoutProjection.Head.unavailable

    /// What is being read, per transcript, in the order the transcripts joined the set.
    ///
    /// Derived rather than counted: a tail's presence in the table IS its liveness, so there is no
    /// second number to fall out of step with it.
    public var observations: [HubObservation] {
        join.transcripts.map { transcript in
            HubObservation(
                id: transcript.id,
                sourceURL: transcript.sourceURL,
                state: tails[transcript.id] == nil ? .stopped : .live,
            )
        }
    }

    /// Read off the same fact: "connected" is a claim about a live source, and a Project with no
    /// tail running has none to make it about.
    public var connection: HubConnection {
        if let failureMessage {
            return .failed(message: failureMessage)
        }
        if isConnecting {
            return .connecting
        }
        return tails.isEmpty ? .idle : .connected
    }

    /// The roster, with what Argo knows from OUTSIDE the transcripts folded in as it is published.
    ///
    /// Folded in on read rather than written into the join, because neither fact is the
    /// transcript's: liveness moves with a process table nothing in the file knows about, and
    /// ownership is this Argo process's own claim. Writing them into the join would make a Session
    /// re-render as changed every time the clock moved.
    ///
    /// The Sessions Argo has SPAWNED sit in the same list, on the same sort key. Their rows exist
    /// before any transcript does (#361) and stand down the moment the record they turned out to be
    /// is bound to their claim — so one agent is one row throughout, never two and never re-keyed.
    public var sessions: [HubSession] {
        HubSessionChain.ordered(join.sessions.map(observed) + provisionalSessions)
    }

    /// The spawned rows belonging to the Project this Hub is currently on.
    ///
    /// Scoped, because the spawns outlive a Project switch and their PTYs are meant to: an agent
    /// Argo started in another repo is still running and still steerable when you go back to it.
    /// What it must not do is appear in a roster it does not belong to — the join is re-pointed on
    /// every switch, and these would otherwise be the one thing that never was.
    private var provisionalSessions: [HubSession] {
        spawns.values
            .filter { ProjectScope.contains(cwd: $0.cwd, projectURL: project.url) }
            .map { observed(HubSession(spawn: $0)) }
    }

    /// Which Sessions this Argo process owns a PTY for. Empty until something spawns one, which is
    /// what makes every discovered Session `external` — a read of the registry, not a default.
    public let ownership = SessionOwnership()

    /// The PTYs behind those claims. Held for the life of this process, and ended with it.
    let terminals = AgentTerminals()

    /// The rows for agents Argo has started whose CLI has not yet written a record. Observed, so a
    /// spawn reaches the roster in the same update that opened its PTY.
    var spawns: [SessionOwnership.ClaimID: AgentSpawn] = [:]

    /// What each claim's agent has said over the companion channel — the CONVENTION tier, and the
    /// only place it comes from. Keyed by claim rather than by Session id because the claim is what
    /// exists first and survives the reconciliation.
    var companionReports: [SessionOwnership.ClaimID: CompanionReport] = [:]

    /// The Permissions each claim's agent is blocked on, oldest first — DIRECT, because Argo holds
    /// the hook that raised them and the channel the answer goes down. Observed, so a prompt
    /// reaches the cockpit in the update that raised it; keyed by claim for the reason the
    /// reports above are.
    var pendingPermissions: [SessionOwnership.ClaimID: [PermissionRequest]] = [:]

    /// The tools each claim has stopped asking about (#572), in the order they were granted.
    /// Observed and keyed by claim for the same reasons the Permissions above are — and published
    /// at all because that is what separates a standing allow from the invisible set it replaces.
    var standingAllows: [SessionOwnership.ClaimID: [StandingAllow]] = [:]

    /// The handoffs THIS process made, keyed by the Session that handed over and holding the id the
    /// fresh row was published under — a claim, until its CLI writes a record. Observed, because a
    /// handoff completing has to reach the reading it is drawn at the foot of.
    var handoffs: [String: String] = [:]

    /// And the ones any Argo made, read from the chain file at launch. Observed for the same
    /// reason: a link that gets named at rebind changes what the reading says.
    var chain = HandoffChain()
    @ObservationIgnored let chainStore: HandoffChainStore

    @ObservationIgnored let spawnServices: SpawnServices
    @ObservationIgnored private(set) var companion: CompanionChannel?
    @ObservationIgnored private(set) var permissions: PermissionChannel?

    /// The working directories a live CLI was running in when the process table was last read, and
    /// when that was. Absent until a read has happened, so an unread liveness resolves down to
    /// quiet rather than up to a running Argo never saw.
    ///
    /// Observed rather than ignored: a Session going quiet has to reach the roster, and the roster
    /// is read off these two.
    var liveCwds: Set<String> = []
    var livenessReadAtMs: Int?
    /// What git last said about each Session's working folder, keyed by cwd. Observed for the
    /// same reason liveness is: a branch that moves or a file that changes has to reach the
    /// roster, and the roster is read off this.
    var workspaces: [String: WorkspaceProjection] = [:]
    @ObservationIgnored var livenessPolling: Task<Void, Never>?

    var join = HubJoin()
    /// The rosters of the Projects this Hub has been pointed at, kept across a switch. The
    /// sweep still re-runs and the tails still re-read on re-entry — what the retained join
    /// removes is the empty roster the reader used to sit in front of while they did.
    @ObservationIgnored private var retainedJoins = HubJoinCache()
    /// The running tail per transcript id. Observed rather than ignored, because `observations`
    /// and `connection` are read off it — a tail starting or ending has to reach the view.
    private var tails: [String: Task<Void, Never>] = [:]
    private var failureMessage: String?
    private var isConnecting = false
    @ObservationIgnored let discovery: SessionDiscovery
    @ObservationIgnored let engine: Engine
    /// What the Hub was last pointed with, held so a retry needs nothing re-supplied — a caller
    /// rebuilding the configuration to retry can rebuild a different one.
    @ObservationIgnored private var configuration: LaunchConfiguration
    /// The Project the sweep is running against, absent while the Hub is disconnected or reading a
    /// named transcript.
    @ObservationIgnored var sweepProjectURL: URL?
    @ObservationIgnored var sweeping: Task<Void, Never>?

    var observedTranscriptIDs: [String] {
        Array(tails.keys)
    }

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
        self.chainStore = HandoffChainStore(fileURL: spawnServices.chainFileURL)
        // Read at construction, like the companion channel below it: the roster is published before
        // anything is swept, and a chain loaded a moment later would blank the link on the first
        // reading of a Session that has one.
        self.chain = chainStore.load()
        openCompanionChannel()
    }

    /// Opened at construction, not lazily: they close over `self`, and a channel that came into
    /// being on the first spawn would be a second thing that could fail at the moment an agent
    /// starts — which is the one moment there is nothing useful to say about it.
    private func openCompanionChannel() {
        let root = spawnServices.companionRoot
        companion = CompanionChannel(root: root) { [weak self] claim, fact in
            self?.record(fact, for: claim)
        }
        permissions = PermissionChannel(
            root: root,
            onChange: { [weak self] claim, waiting in self?.publish(waiting, for: claim) },
            onStanding: { [weak self] claim, standing in
                self?.publish(standing: standing, for: claim)
            },
        )
    }

    /// Point the Hub at a Project. Everything the previous one established is cancelled and
    /// dropped first, so no tail of it survives and no event of it reaches the rebuilt roster.
    ///
    /// With no transcript named, the Sessions are the ones discovery finds on disk and the working
    /// set keeps moving while the app runs. A named transcript is the render harness's explicit
    /// override: the caller has said what to read, so nothing is swept for.
    ///
    /// Returns once the tails have started, not once they end — a live transcript has no end, so a
    /// `connect` that awaited them would never return.
    public func connect(to configuration: LaunchConfiguration) async {
        isConnecting = true
        defer { isConnecting = false }
        await disconnect()
        self.configuration = configuration
        project = HubProject(url: configuration.projectURL)
        await refreshCheckout()
        // Taken against the RESOLVED Project, which is the key it was retained under.
        join = retainedJoins.take(for: project.url.path) ?? HubJoin()
        // Polled for whichever way the transcripts were found: whether a CLI is still running is a
        // fact about the world, and a named transcript's Session is no less observed than a swept
        // one's.
        await beginLiveness()
        guard !configuration.transcriptURLs.isEmpty else {
            // The sweep runs against the RESOLVED Project, which `refreshCheckout` has just read:
            // launched inside a subdirectory of a repo, the Project is the repo, and scoping to the
            // launch path would hide every Session working anywhere else in it.
            await beginDiscovery()
            return
        }
        await observeNamed(configuration.transcriptURLs)
    }

    /// Point again at the configuration the Hub is already on — what a retry after a failed
    /// connection IS. Rebuilding the configuration to retry is how a retry quietly moves you.
    public func reconnect() async {
        await connect(to: configuration)
    }

    /// Drop the whole Project: the sweep, every tail, the join they fed, and the checkout and
    /// failure read alongside them. The checkout goes too, rather than being left to be
    /// overwritten — a branch belonging to the repo we are no longer pointed at is a fact we do not
    /// have.
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
    /// connection: the caller asked for those files, so a missing one is its answer rather than a
    /// smaller roster. Discovery's own opens are skipped instead — see `refreshWorkingSet`.
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
    /// working set immediately — the ROSTER once the file has been read — and stopping it later
    /// leaves every other tail running.
    public func startObserving(_ observation: TranscriptObservation) async {
        await stopObserving(transcriptID: observation.id)
        await startTailing(observation)
    }

    /// Start tailing one transcript, keeping whatever row the roster already holds for it.
    ///
    /// What discovery calls, and the distinction is not cosmetic: the join resolves a record's
    /// owner by which transcript claimed it FIRST, so re-adding a paused resume-chain root would
    /// put it behind its own continuation and re-attribute the records it authored. A tail re-reads
    /// from the start of the file, so the row it rejoins is rebuilt rather than left stale.
    func startTailing(_ observation: TranscriptObservation) async {
        await pauseObserving(transcriptID: observation.id)
        join.add(observation)
        // A tail running is the answer to any previous failure: whatever could not be read, this
        // one can, and a connection reading `failed` over a live source is a stale claim.
        failureMessage = nil
        tails[observation.id] = Task { [weak self] in await self?.drain(observation) }
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    public func stopObserving(transcriptID: String) async {
        join.remove(transcriptID: transcriptID)
        await pauseObserving(transcriptID: transcriptID)
    }

    /// Stop one tail, keeping in the roster the Session it read. What discovery calls when a
    /// transcript ages out of the working set: the descriptors are the bounded resource, and a row
    /// vanishing under the user would be a claim that the Session never happened.
    ///
    /// Awaits the cancelled task, so a stopped tail is provably over before this returns. That is
    /// what keeps a straggling event from landing under an id re-registered in the meantime — the
    /// dead tail cannot still be running when the live one takes the id.
    public func pauseObserving(transcriptID: String) async {
        guard let task = tails.removeValue(forKey: transcriptID) else { return }
        task.cancel()
        await task.value
    }

    /// Re-read the checkout of the Project this Hub is on — the only Project it could be a refresh
    /// OF. The read resolves the repository root as well, so the answer to "which Project" moves
    /// from the folder the caller named to the repo git says it is in, once.
    public func refreshCheckout() async {
        let projection = await engine.checkout(at: project.url)
        project = HubProject(url: projection.repositoryURL)
        checkout = projection.head
    }

    /// The join is emptied before anything is cancelled, so a tail that gets one more turn while
    /// tearing down finds no transcript to apply against. Cancelling the whole set before awaiting
    /// any of it keeps a slow teardown from serialising behind the one in front of it.
    private func stopObservingAll() async {
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
        // The record ended, so the projection has to stop calling this transcript live. Clearing by
        // id is safe: every path that re-registers an id awaits the previous tail to completion
        // first, so no later tail can be holding the key by the time this runs.
        tails.removeValue(forKey: observation.id)
    }
}
