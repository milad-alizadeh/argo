import Foundation

/// The Session facts the shell can establish directly from one transcript stream.
public struct HubSession: Equatable, Identifiable, Sendable {
    public let id: String
    /// Absent for a Session Argo just spawned: the CLI writes no record until its first prompt.
    public let sourceURL: URL?
    /// The file of the chain's LATEST link. `sourceURL` is the root's and stays the root's, because
    /// the id everything links against must not move when the chain grows.
    private var chainTipURL: URL?
    /// Set by the Hub off the ownership registry, never asserted here: a transcript file says
    /// nothing about who spawned the CLI that wrote it.
    public internal(set) var provenance: SessionProvenance = .external
    /// Set by the Hub from its own liveness read; quiet until one has been taken, because ambiguity
    /// resolves toward the quieter state.
    public internal(set) var liveness: SessionLiveness = .quiet
    /// Which agent program wrote this record (`CONTEXT.md` L2). Set by the Hub from the record
    /// store, or DIRECT from the spawn; never guessed from the prose inside the file.
    public internal(set) var cli: AgentCLI?
    /// Absent until a read has happened, and for a folder git could not answer for — an unread
    /// Workspace is not a clean one.
    public internal(set) var workspace: WorkspaceProjection?
    /// Absent for every external Session and for a managed one whose agent has not spoken — not a
    /// degrade, only the tier having nothing to say yet.
    public internal(set) var convention: CompanionReport?
    /// DIRECT: the blocked hook and the channel its answer goes down are both Argo's own. Absent
    /// for
    /// every external Session (unobservable there, per ADR-0024).
    public internal(set) var permission: PermissionRequest?
    /// The tools this Session has stopped asking about (#572) — DIRECT, and empty rather than
    /// absent because "no standing allow" is a state every Session is honestly in.
    public internal(set) var standingAllows: [StandingAllow] = []
    /// The Permissions Argo's own clock refused (#573) — DIRECT, and empty rather than absent for
    /// the reason the grants above are.
    public internal(set) var expiredPermissions: [PermissionExpiry] = []
    /// What the CLI's own protocol says this Session is doing, where Argo drives one that reports
    /// it (#683). Absent for every other Session, which is most of them.
    public internal(set) var driveStatus: SessionStatus?
    /// Set by the Hub from its own record of the handoff, never read from a transcript: neither CLI
    /// knows anything happened.
    public internal(set) var handedOffTo: String?
    /// What this row is called, and how firmly — see `SessionTitle`.
    private var name: SessionTitle
    public var title: String {
        name.text
    }

    public private(set) var cwd: String?
    public private(set) var model: String?
    public private(set) var branch: String?
    /// The rung Argo ITSELF put this Session on — off the spawn, or off a later set. The only
    /// place Plan can come from: the CLI reports Read Only's boundary for both (ADR-0025).
    public internal(set) var modeSet: SessionModeSet?
    /// The last Turn typed at this Session that the CLI never heard (#682), verbatim.
    ///
    /// A Turn is submitted by a Return the file-mention popup can eat, and the composer clears on
    /// the keystroke having been WRITTEN. This is the later news that it was never read, so the
    /// words can go back where they were typed instead of being lost to a send that only looked
    /// like one.
    public internal(set) var lostTurn: String?
    /// The CLI's own word for the stance, latest reading and nothing yet where no record said one.
    private(set) var observedMode: String?
    /// How many stance records the Session has written. A rung Argo set stands until this moves
    /// past what it was when the set was made — see `SessionModeSet` for why it is counted rather
    /// than compared.
    private(set) var observedModeCount = 0
    public private(set) var headLeafUUID: String?
    /// Everything the transcript said, in the order it said it. The facts above are a lossy fold
    /// over this stream, which is why it is retained whole for the surfaces that read it.
    public private(set) var events: [TranscriptEvent] = []
    /// How full the Session's context is: the tokens the LATEST reported spend was made against,
    /// not a sum — every request re-sends the whole conversation, so summing would count the same
    /// context once per turn. Falls as well as rises: the reading after a compaction is the
    /// compacted one. Absent until a record carries a `usage` object at all.
    public private(set) var contextTokens: Int?
    /// Every spend the records reported, added with `Usage`'s own `+`. Both grains, per
    /// `CONTEXT.md` L3: the assistant records' own usage, plus whatever a delegating call reported
    /// for the subagent it ran.
    private var spend: Usage?
    /// The subagent half of it, kept separately because the header says it separately.
    private var subagentSpend: Usage?
    public private(set) var lastActivityAtMs: Int?
    /// The oldest moment the records report — the fact a claim window is matched against.
    public private(set) var startedAtMs: Int?
    /// The file's own last write — what a transcript whose records carry no time still says about
    /// when it ran.
    private var recordedAtMs: Int?
    /// Whether an AGENT has ever spoken here — said something, thought, called a tool, ended a
    /// turn, or been priced. A prompt does not count: it is what was ASKED. DIRECT for a Session
    /// Argo spawned (`init(spawn:)` sets it).
    public private(set) var hasAgentActivity = false
    /// Whether the host wrote a `queue-operation` record here — a prompt QUEUED rather than run.
    /// The CLI opens a transcript per queued prompt, each holding one copy of the same words, so
    /// queued with no agent output beside it is not its own Session. Queued AND answered is.
    public private(set) var isQueued = false
    private(set) var turnOpen = false
    private(set) var lastStop: StopReason?
    /// The `AskUserQuestion` calls in the open Turn that no result has answered.
    private(set) var pendingAsks: Set<String> = []

    /// `nil` where neither source could say — the roster sorts such a Session last rather than
    /// giving it a guessed time, and liveness reads it as uncorroborated rather than recent.
    public var lastSeenAtMs: Int? {
        lastActivityAtMs ?? recordedAtMs
    }

    /// What `--resume` is given to continue this Session (#10): the CLI's own id for the chain's
    /// latest link, which `claude` writes the transcript file under. Resuming the ROOT instead
    /// would fork the chain at the point its first continuation left it.
    ///
    /// Absent for a Session with no record on disk — a spawn whose CLI has written nothing has no
    /// chain to continue.
    var resumeID: String? {
        chainTipURL?.deletingPathExtension().lastPathComponent
    }

    /// What the Session has SPENT across its whole life, cache excluded (that is `cachedTokens`).
    /// Absent until a record prices something: a Session nobody priced has not spent nothing.
    public var spentTokens: Int? {
        spend?.spentTokens
    }

    /// The cache half of the same life: read and re-read once per request, so it runs to tens of
    /// millions on a long Session while the spend stays small. Absent with `spentTokens`.
    public var cachedTokens: Int? {
        spend?.cachedTokens
    }

    /// Read off the DELEGATING call's result — the only place that spend is ever reported, since a
    /// sidechain's own records carry none. Absent, never zero: a zero would claim no subagent ran.
    public var subagentTokens: Int? {
        subagentSpend?.billedTokens
    }

    public init(observation: TranscriptObservation) {
        self.id = observation.id
        self.sourceURL = observation.sourceURL
        self.chainTipURL = observation.sourceURL
        self.name = SessionTitle(
            startingWith: observation.sourceURL.deletingPathExtension().lastPathComponent,
        )
        self.recordedAtMs = observation.modifiedAt?.epochMs
    }

    /// The row for an agent Argo has just STARTED, before the CLI has written a record (#361).
    ///
    /// Its id IS the claim's — the only handle the spawn and the terminal share until the CLI picks
    /// one. Idle, not running: a spawn IS a Turn boundary, and rendering it DIRECT keeps the row
    /// off
    /// `unknown` until the liveness poll catches up. A PTY that goes without a record ever
    /// appearing
    /// closes that Turn `cancelled`; the `ended` the roster then shows comes from the orphaned
    /// provenance, never from a reason invented here.
    init(spawn: AgentSpawn) {
        self.id = spawn.claim.value
        self.sourceURL = nil
        self.name = SessionTitle(startingWith: spawn.title)
        self.cwd = spawn.cwd
        // DIRECT: Argo chose this program and started it.
        self.cli = spawn.cli
        self.lastActivityAtMs = spawn.exit?.atMs ?? spawn.spawnedAtMs
        self.startedAtMs = spawn.spawnedAtMs
        self.lastStop = spawn.exit == nil ? .endTurn : .cancelled
        // DIRECT: Argo started this process, so the row belongs on the roster from the moment it
        // exists.
        self.hasAgentActivity = true
    }

    mutating func apply(_ event: TranscriptEvent) {
        events.append(event)
        switch event {
        case .recordIdentity:
            break
        case let .headLeaf(uuid):
            headLeafUUID = uuid
        case let .title(observedTitle):
            name.state(observedTitle)
        case let .cwd(observedCwd):
            cwd = observedCwd
        case let .model(observedModel):
            model = observedModel
        case let .branch(observedBranch):
            branch = Self.branchName(observedBranch)
        case let .mode(cli):
            observe(mode: cli)
        case let .prompt(text, atMs):
            name.observe(prompt: text)
            turnOpen = true
            observeActivity(atMs)
        case let .turnEnded(reason):
            hasAgentActivity = true
            turnOpen = false
            lastStop = reason
            // A question the Turn it was asked in has left behind is not still waiting on anyone.
            pendingAsks = []
        case let .toolCall(call):
            hasAgentActivity = true
            if call.name == ToolCall.askUserQuestion {
                pendingAsks.insert(call.id)
            }
            observeActivity(call.atMs)
        case let .toolCallOutcome(outcome):
            hasAgentActivity = true
            pendingAsks.remove(outcome.id)
            observeActivity(outcome.endedAtMs)
            observeSubagentSpend(outcome.usage)
        case let .compaction(atMs):
            hasAgentActivity = true
            observeActivity(atMs)
        case let .usage(usage):
            hasAgentActivity = true
            contextTokens = usage.contextTokens
            spend = Self.summed(spend, usage)
        case .message, .thought, .plan:
            hasAgentActivity = true
        case .queued:
            isQueued = true
        // An unreadable line says a file was written, never who wrote it — which is exactly the
        // claim `hasAgentActivity` is about, so it deliberately does not count. A skill load is the
        // CLI expanding a body in front of the agent, and the agent has not answered yet, so it
        // does not count either — the reading below it is where the activity shows up.
        case .unreadableLine, .skillLoaded:
            break
        }
    }

    /// The value and the count move together, always: a rung Argo set stands until the count moves
    /// past what it was, so a value written without one would freeze the reading on the set.
    private mutating func observe(mode cli: String) {
        observedMode = cli
        observedModeCount += 1
    }

    /// A delegating call's result carries the subagent's whole spend, so it counts twice: the
    /// subagent line, and the Session total. Nothing reported leaves both absent, never zero.
    private mutating func observeSubagentSpend(_ usage: Usage?) {
        guard let usage else { return }
        subagentSpend = Self.summed(subagentSpend, usage)
        spend = Self.summed(spend, usage)
    }

    /// A detached checkout makes the CLI write the literal `HEAD`, which is not a ref anybody can
    /// check out. Read here, as the fact enters the Hub, so no surface has to know the convention.
    private static func branchName(_ observed: String) -> String? {
        observed == "HEAD" ? nil : observed
    }

    /// The latest time wins, and an absent one says nothing: a record with no timestamp is not a
    /// Session that ran at the epoch.
    private mutating func observeActivity(_ atMs: Int?) {
        guard let atMs else { return }
        lastActivityAtMs = max(lastActivityAtMs ?? atMs, atMs)
        startedAtMs = min(startedAtMs ?? atMs, atMs)
    }

    mutating func mergeContinuation(_ continuation: HubSession) {
        name.merge(continuation.name)
        // A resume file opened and not yet answered does not un-run the reading it continues.
        hasAgentActivity = hasAgentActivity || continuation.hasAgentActivity
        isQueued = isQueued || continuation.isQueued
        // Appended, not merged: a resume chain is walked root-first, so the continuation's stream
        // is the later half of one reading and belongs behind what came before it.
        events += continuation.events
        cwd = continuation.cwd ?? cwd
        model = continuation.model ?? model
        // The later half of the chain wins where it read one, and says nothing where it did not: a
        // resume file with no `usage` in it yet is not a Session that has emptied its context.
        contextTokens = continuation.contextTokens ?? contextTokens
        // Spend, unlike the context reading, ADDS across the chain: a resumed file's tokens were
        // billed on top of the root's, not instead of them.
        spend = Self.summed(spend, continuation.spend)
        subagentSpend = Self.summed(subagentSpend, continuation.subagentSpend)
        branch = continuation.branch ?? branch
        // A resume is a fresh `claude` with its own flag, so the later half's stance is the live
        // one
        // — and a file that has not stated one yet does not un-state the root's.
        observedMode = continuation.observedMode ?? observedMode
        modeSet = continuation.modeSet ?? modeSet
        headLeafUUID = continuation.headLeafUUID ?? headLeafUUID
        // The tip moves with the chain, unlike `sourceURL`: a resume continues the last link, and
        // the last link is whatever was merged in most recently.
        chainTipURL = continuation.chainTipURL ?? chainTipURL
        observeActivity(continuation.lastActivityAtMs)
        observeActivity(continuation.startedAtMs)
        recordedAtMs = continuation.recordedAtMs.map { max(recordedAtMs ?? $0, $0) } ?? recordedAtMs
        // A resume file with no Turn in it yet says nothing about the chain, and taking its
        // silence would close the root's open Turn.
        if continuation.turnOpen || continuation.lastStop != nil {
            turnOpen = continuation.turnOpen
            lastStop = continuation.lastStop
            pendingAsks = continuation.pendingAsks
        }
    }

    /// Two spends added without either of them being able to invent one: an absent half leaves the
    /// other exactly as it was, and two absences stay absent.
    private static func summed(_ left: Usage?, _ right: Usage?) -> Usage? {
        guard let left else { return right }
        guard let right else { return left }
        return left + right
    }
}
