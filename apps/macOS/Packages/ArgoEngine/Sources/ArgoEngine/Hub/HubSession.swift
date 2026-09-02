import Foundation

/// The Session facts the shell can establish directly from one transcript stream.
public struct HubSession: Equatable, Identifiable, Sendable {
    public let id: String
    /// Absent for a Session Argo just spawned: the CLI writes no record until its first prompt.
    public let sourceURL: URL?
    /// The file of the chain's LATEST link. `sourceURL` is the root's and stays the root's, because
    /// the id everything links against must not move when the chain grows.
    private(set) var chainTipURL: URL?
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
    /// Whether the channel that tier arrives over is up (#493) — DIRECT. `notApplicable` until the
    /// Hub has a channel to report on, which is the quietest of the four (degrade-down).
    public internal(set) var companionChannel: CompanionLiveness = .notApplicable
    /// DIRECT: the blocked hook and the channel its answer goes down are both Argo's own. Absent
    /// for every external Session (unobservable there, per ADR-0024).
    public internal(set) var permission: PermissionRequest?
    /// The question this Session is blocked on (#712) — DIRECT, and absent for every Session whose
    /// gate is not Argo's own. A live handle with an id, unlike the `Ask` the feed reads out of the
    /// transcript, which is a reading of a question already put and cannot be answered.
    public internal(set) var ask: SessionAsk?
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
    /// The Ticket this Session was STARTED on, by number (#872). DIRECT — Argo was told at the
    /// spawn — and absent for every Session started on no ticket, which is every external one and
    /// every plain New Session. The link read off a branch is the DERIVED reading beside it, and
    /// the cockpit prefers this one where both are there.
    public internal(set) var ticket: Int?
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
    /// How much of the record this Session was read from — see `SessionTranscriptExtent`. `whole`
    /// by default because that is what a spawn and a full drain both are; only the seam a bounded
    /// read leaves can move it, and it never moves back.
    public private(set) var transcriptExtent: SessionTranscriptExtent = .whole
    /// The session id this chain started as. Internal, and read by `HubSessionChain` alone: it is a
    /// join key, not a fact any surface renders.
    private(set) var originSessionID: String?
    /// Everything the transcript said, in the order it said it, with the stamp that stands for it.
    /// The facts above are a lossy fold over this stream, which is why it is retained whole for the
    /// surfaces that read it. A Subagent's own reading is NOT here: it is the child's, and it is
    /// published beside the roster rather than inside it (`SubagentReadings`, #858).
    ///
    /// Written only from here and read through `HubSession+Transcript.swift`: the stamp is honest
    /// because `TranscriptStream` holds the records privately, so no write anywhere can reach them
    /// without going through the observer that restamps.
    private(set) var transcript = TranscriptStream()
    /// How full the Session's context is: the tokens the LATEST reported spend was made against,
    /// not a sum — every request re-sends the whole conversation, so summing would count the same
    /// context once per turn. Falls as well as rises: the reading after a compaction is the
    /// compacted one. Absent until a record carries a `usage` object at all.
    public private(set) var contextTokens: Int?
    /// Every spend the records reported, at both grains — see `SessionSpend`, which owns the
    /// arithmetic and the three token readings the header draws from it.
    private(set) var spend = SessionSpend()
    public private(set) var lastActivityAtMs: Int?
    /// The oldest moment the records report. The roster's sort key, and no longer any part of
    /// ownership: a claim names its Session rather than matching a window (#742).
    public private(set) var startedAtMs: Int?
    /// The file's own last write — what a transcript whose records carry no time still says about
    /// when it ran.
    private(set) var recordedAtMs: Int?
    /// Whether an AGENT has ever spoken here — said something, thought, called a tool, ended a
    /// turn, or been priced. A prompt does not count: it is what was ASKED. DIRECT for a Session
    /// Argo spawned (`init(spawn:)` sets it).
    public private(set) var hasAgentActivity = false
    /// Whether the host wrote a `queue-operation` record here — a prompt QUEUED rather than run.
    /// The CLI opens a transcript per queued prompt, each holding one copy of the same words, so
    /// queued with no agent output beside it is not its own Session. Queued AND answered is.
    public private(set) var isQueued = false
    /// The Turn in flight and what the last one ended as — see `SessionTurnState`.
    private(set) var turn = SessionTurnState()

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
    /// off `unknown` until the liveness poll catches up. A PTY that goes without a record ever
    /// appearing closes that Turn `cancelled`; the `ended` the roster then shows comes from the
    /// orphaned provenance, never from a reason invented here.
    init(spawn: AgentSpawn) {
        self.id = spawn.claim.value
        self.sourceURL = nil
        self.name = SessionTitle(startingWith: spawn.title)
        self.cwd = spawn.cwd
        // DIRECT: Argo chose this program and started it.
        self.cli = spawn.cli
        // DIRECT on the same ground: the row is claimed from the moment it appears, rather than
        // once a branch has been cut for something to read the number off (#872).
        self.ticket = spawn.ticket
        self.lastActivityAtMs = spawn.exit?.atMs ?? spawn.spawnedAtMs
        self.startedAtMs = spawn.spawnedAtMs
        self.turn = SessionTurnState(lastStop: spawn.exit == nil ? .endTurn : .cancelled)
        // DIRECT: Argo started this process, so the row belongs on the roster from the moment it
        // exists.
        self.hasAgentActivity = true
    }

    mutating func apply(_ event: TranscriptEvent) {
        transcript.append(event)
        switch event {
        case .recordIdentity:
            break
        case let .headLeaf(uuid):
            headLeafUUID = uuid
        case let .originSession(id):
            originSessionID = id
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
        case let .prompt(text, _, atMs):
            name.observe(prompt: text)
            turn.opened()
            observeActivity(atMs)
        case let .turnEnded(reason):
            hasAgentActivity = true
            turn.ended(reason)
        case let .toolCall(call):
            observe(call: call)
        case let .toolCallOutcome(outcome):
            hasAgentActivity = true
            turn.answered(outcome.id)
            observeActivity(outcome.endedAtMs)
            spend.observe(subagent: outcome.usage)
        case let .compaction(atMs):
            hasAgentActivity = true
            observeActivity(atMs)
        case let .usage(usage):
            hasAgentActivity = true
            contextTokens = usage.contextTokens
            spend.observe(usage)
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
        case .excerpted:
            // One way only: reading the missing stretch means reading the file again, and that
            // arrives as a fresh Session rather than as more events on this one.
            transcriptExtent = .excerpt
        }
    }

    private mutating func observe(call: ToolCall) {
        hasAgentActivity = true
        turn.observe(call)
        observeActivity(call.atMs)
    }

    /// The value and the count move together, always: a rung Argo set stands until the count moves
    /// past what it was, so a value written without one would freeze the reading on the set.
    private mutating func observe(mode cli: String) {
        observedMode = cli
        observedModeCount += 1
    }

    /// A detached checkout makes the CLI write the literal `HEAD`, which is not a ref anybody can
    /// check out. Read here, as the fact enters the Hub, so no surface has to know the convention.
    private static func branchName(_ observed: String) -> String? {
        observed == "HEAD" ? nil : observed
    }

    /// The latest time wins, and an absent one says nothing: a record with no timestamp is not a
    /// Session that ran at the epoch.
    ///
    /// The EARLIEST is only taken while the reading is still whole. A moment read after a bounded
    /// read's seam sits behind a stretch nobody opened, so it cannot be the earliest one the file
    /// holds — and an unread start is unknown rather than "the oldest thing this happened to see"
    /// (`SessionTranscriptExtent`). The roster sorts on the latest, which a tail always reads, so
    /// what this withholds costs no row its place.
    private mutating func observeActivity(_ atMs: Int?) {
        guard let atMs else { return }
        lastActivityAtMs = max(lastActivityAtMs ?? atMs, atMs)
        guard transcriptExtent == .whole else { return }
        startedAtMs = min(startedAtMs ?? atMs, atMs)
    }

    mutating func mergeContinuation(_ continuation: HubSession) {
        name.merge(continuation.name)
        // A resume file opened and not yet answered does not un-run the reading it continues.
        hasAgentActivity = hasAgentActivity || continuation.hasAgentActivity
        isQueued = isQueued || continuation.isQueued
        // Appended, not merged: a resume chain is walked root-first, so the continuation's stream
        // is the later half of one reading and belongs behind what came before it. See
        // `TranscriptStream.merge`.
        transcript.merge(continuation.transcript)
        cwd = continuation.cwd ?? cwd
        model = continuation.model ?? model
        // The later half of the chain wins where it read one, and says nothing where it did not: a
        // resume file with no `usage` in it yet is not a Session that has emptied its context.
        contextTokens = continuation.contextTokens ?? contextTokens
        spend.merge(continuation.spend)
        branch = continuation.branch ?? branch
        // A resume is a fresh `claude` with its own flag, so the later half's stance is the live
        // one — and a file that has not stated one yet does not un-state the root's.
        observedMode = continuation.observedMode ?? observedMode
        modeSet = continuation.modeSet ?? modeSet
        // A resume continues the work the root was started on, so the later half only adds a ticket
        // where the root named none.
        ticket = continuation.ticket ?? ticket
        headLeafUUID = continuation.headLeafUUID ?? headLeafUUID
        // A chain is read whole only where every link was: one bounded link leaves the joined
        // reading with a hole in it, and its totals are as partial as that link's.
        if continuation.transcriptExtent == .excerpt {
            transcriptExtent = .excerpt
        }
        // The tip moves with the chain, unlike `sourceURL`: a resume continues the last link, and
        // the last link is whatever was merged in most recently.
        chainTipURL = continuation.chainTipURL ?? chainTipURL
        observeActivity(continuation.lastActivityAtMs)
        observeActivity(continuation.startedAtMs)
        recordedAtMs = continuation.recordedAtMs.map { max(recordedAtMs ?? $0, $0) } ?? recordedAtMs
        turn.merge(continuation.turn)
    }
}
