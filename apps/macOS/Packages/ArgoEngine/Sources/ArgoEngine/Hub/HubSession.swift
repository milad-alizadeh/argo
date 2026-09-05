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
    /// How the process behind this Session was STARTED (`CONTEXT.md` L2 · Entry) — DERIVED, off
    /// the host's own `entrypoint`, and `interactive` until a record says otherwise.
    public private(set) var entry: SessionEntry = .interactive
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
    /// The waits Argo held here that have ENDED (#1323), oldest first — see `SessionWaitSettled`.
    /// DIRECT by construction, and empty for every Session Argo did not start: nothing observed
    /// from outside can produce one, which is what keeps the plinth off a Session Argo only watched
    /// change posture.
    public internal(set) var settledWaits: [SessionWaitSettled] = []
    /// What the CLI's own protocol says this Session is doing, where Argo drives one that reports
    /// it (#683). Absent for every other Session, which is most of them.
    public internal(set) var driveStatus: SessionStatus?
    /// Set by the Hub from its own record of the handoff, never read from a transcript: neither CLI
    /// knows anything happened.
    public internal(set) var handedOffTo: String?
    /// Whether Argo is running `/handoff` here right now (#1327) — DIRECT, off Argo's own act. What
    /// the header button and the plinth both read, so neither carries the fact on its own.
    ///
    /// Beside `handoffFailures`, the handoffs Argo attempted here that did NOT land, oldest first
    /// — each drops a failed row into the reading. Empty for every Session that never tried one,
    /// or whose only attempt landed: a landed handoff leaves nothing here, because `handedOffTo`
    /// above is its record.
    public internal(set) var handingOff = false, handoffFailures: [SessionWaitSettled] = []
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
    /// The model the records report, latest reading and nothing yet where no record said one
    /// (#558). Not public and not the whole answer: `model` in `HubSession+Run.swift` is the
    /// reading, which opens on what Argo started the CLI at (#1175).
    ///
    /// A provider's id off an assistant record, or the alias a `/model` command was handed once
    /// that command confirmed it (`CommandedModel`, #1411) — the same two vocabularies
    /// `launchedRun` already holds, and `ReadableModelName` says either the way a person does.
    private(set) var observedModel: String?
    /// The CLI's own word for the effort level, on the same terms as `observedModel` above.
    /// Verbatim like `observedMode`: what it means on Argo's scale is `ClaudeEffort`'s to say, and
    /// nothing here reads it.
    private(set) var observedEffort: String?
    public private(set) var branch: String?
    /// The rung Argo ITSELF put this Session on — off the spawn, or off a later set. The only
    /// place Plan can come from: the CLI reports Read Only's boundary for both (ADR-0025).
    public internal(set) var modeSet: SessionModeSet?
    /// The Model and Effort Argo STARTED this Session at, off the spawn's own argv (#1175). The
    /// opening reading for a managed Session, and absent for every external one — Argo did not
    /// start it and has no argv to read.
    var launchedRun: SessionRun?
    /// The last Turn typed at this Session that the CLI never heard (#682), verbatim.
    ///
    /// A Turn is submitted by a Return the file-mention popup can eat, and the composer clears on
    /// the keystroke having been WRITTEN. This is the later news that it was never read, so the
    /// words can go back where they were typed instead of being lost to a send that only looked
    /// like one.
    public internal(set) var lostTurn: String?
    /// The backgrounded delegations the reader ended from the rail (#1267), by call id — see
    /// `ClaimFacts.endedDelegations`. Not public: it is an INPUT to the status fold below, and
    /// `delegationHold` is the reading a surface draws. Empty for every external Session, which has
    /// no claim to file a gesture against.
    var endedDelegations: Set<String> = []
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
    /// compacted one. `unread` until a record carries a `usage` object at all, which a surface
    /// draws as nothing rather than as a word (#1249) — see `ContextReading`.
    public private(set) var context = ContextReading.unread
    /// Every spend the records reported, at both grains — see `SessionSpend`, which owns the
    /// arithmetic and the three token readings the header draws from it.
    private(set) var spend = SessionSpend()
    /// Every moment this Session is placed in time by — see `SessionMoments`, which owns the fold
    /// each one takes. Two of the three are republished under their own names in
    /// `HubSession+Readings.swift`, which is where a public fact has to sit for ADR-0027's edge 5
    /// to see it.
    private(set) var moments = SessionMoments()
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
    /// The last Turn ARGO put to this Session (#1048) — see `SessionTurnSubmission`, which owns
    /// whether that Turn is still running. Set by the Hub off the submit it performed itself. Not
    /// public, because it is an input to the status fold rather than a fact a surface draws:
    /// ADR-0027 has none of it to project.
    var submittedTurn: SessionTurnSubmission?
    /// Where this row's spawn is in the wait for its CLI's first byte (#1328) — see
    /// `SessionStartup`. Set by `init(spawn:)` for a spawn's own row, and by a resume's own claim
    /// otherwise — the one wait that reaches an EXISTING row rather than a provisional one.
    var startup = SessionStartup.notWaiting
    /// Whether the wait above is a resume rather than a plain start (#10, ADR-0026, #1328) — what
    /// tells the plinth which of the two identical waits it is drawing.
    public internal(set) var resuming = false

    public init(observation: TranscriptObservation) {
        self.id = observation.id
        self.sourceURL = observation.sourceURL
        self.chainTipURL = observation.sourceURL
        self.name = SessionTitle(
            startingWith: observation.sourceURL.deletingPathExtension().lastPathComponent,
        )
        self.moments = SessionMoments(recordedAtMs: observation.modifiedAt?.epochMs)
    }

    /// The row for an agent Argo has just STARTED, before the CLI has written a record (#361).
    ///
    /// Its id IS the claim's — the only handle the spawn and the terminal share until the CLI picks
    /// one. `starting` until the PTY carries bytes and idle after — never running: a spawn IS a
    /// Turn boundary, and rendering it DIRECT keeps the row off `unknown` until the liveness poll
    /// catches up. A PTY that goes without a record ever
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
        self.moments = SessionMoments(
            startedAtMs: spawn.spawnedAtMs,
            lastActivityAtMs: spawn.startup.exit?.atMs ?? spawn.spawnedAtMs,
        )
        self.turn = SessionTurnState(lastStop: spawn.startup.exit == nil ? .endTurn : .cancelled)
        // DIRECT: Argo started this process, so the row belongs on the roster from the moment it
        // exists.
        self.hasAgentActivity = true
        // `resuming` stays `false`: `provisionalSessions` never builds this row for a resuming
        // spawn (#1328) — `Hub.observed(_:)` merges that wait onto the Session's own row instead.
        self.startup = SessionStartup(spawn)
        // Off the spawn itself, because the ledger cannot answer for a row that has not bound yet:
        // a claim is keyed to a Session id at the CLI's first record, and the wait for the first
        // BYTE ends before that. The ledger carries the same fact for the life after the bind, and
        // `Hub.observed(_:)` prefers it there.
        self.settledWaits = SessionWaitSettled.startup(of: spawn).map { [$0] } ?? []
    }
}

/// Folding one transcript event into the facts above.
///
/// Both folds in this file are here rather than in files of their own because the facts they write
/// are `private(set)`, which Swift scopes to the declaring file.
extension HubSession {
    mutating func apply(_ event: TranscriptEvent) {
        transcript.append(event)
        switch event {
        // One line each, for the reason the CLI's two knobs below take one: they are the shortest
        // arms in this switch — a name written down verbatim — and spread over two they cost this
        // FILE its length ceiling, which the fact added above it spends the rest of.
        case let .headLeaf(uuid): headLeafUUID = uuid
        case let .originSession(id): originSessionID = id
        case let .title(observedTitle):
            name.state(observedTitle)
        case let .cwd(observedCwd):
            cwd = observedCwd
        // The CLI's own two knobs, both verbatim and latest-wins (#558). One line each: they are
        // the two shortest arms in this switch, and spreading them costs the body its ceiling.
        case let .model(reported): observedModel = reported
        case let .effort(reported): observedEffort = reported
        case let .branch(observedBranch):
            branch = Self.branchName(observedBranch)
        case let .entry(cli):
            entry = SessionEntry(entrypoint: cli)
        case let .mode(cli):
            observe(mode: cli)
        case let .prompt(text, _, atMs):
            observe(prompt: text, atMs: atMs)
        case let .turnEnded(reason):
            hasAgentActivity = true
            turn.ended(reason)
        // No `hasAgentActivity` and no moment: the report's own outcome beside it carries both
        // (#1299).
        case .turnResumed: turn.opened()
        // A Turn somebody stopped is a Turn that ended, and `cancelled` is the word for why
        // (#1189). No `hasAgentActivity`: the marker says what the READER did, and an agent that
        // never spoke is not shown to have worked by being interrupted. The moment counts all the
        // same — something happened on this Session, and recency is about the Session.
        //
        // Deliberate where it meets `HubSessionChain.isPublished`: a QUEUED prompt stopped before
        // any agent picked it up stays off the roster. That pair still means what it says — a file
        // nothing will ever write to again — and stopping a prompt no agent ever answered is the
        // reader agreeing with it, not evidence against it.
        case let .interrupted(atMs):
            turn.ended(.cancelled)
            observeActivity(atMs)
        // Another pair spent one line each, on the same ground as the two above (#1328 spent the
        // fact this file's headroom bought).
        case let .toolCall(call): observe(call: call)
        case let .toolCallOutcome(outcome): observe(outcome: outcome)
        case let .compaction(atMs):
            hasAgentActivity = true
            observeActivity(atMs)
        case let .usage(usage):
            observe(usage: usage)
        case .message, .thought, .plan:
            hasAgentActivity = true
        case .queued: isQueued = true
        // An unreadable line says a file was written, never who wrote it — which is exactly the
        // claim `hasAgentActivity` is about, so it deliberately does not count. A skill load is the
        // CLI expanding a body in front of the agent, and the agent has not answered yet, so it
        // does not count either — the reading below it is where the activity shows up.
        // `superseded` is spent by the STREAM, which takes the abandoned branch back out rather
        // than appending it (#1202, `TranscriptStream.append`). Nothing is folded off it here: the
        // scalars below are claims about what this Session DID, and the agent really did speak on
        // the branch it abandoned, so un-saying its spend or its activity would be a quieter
        // reading than the truth. The Turn needs no unwinding either — the record that supersedes
        // is a prompt, and it opens the Turn again in the same act.
        case .unreadableLine, .skillLoaded, .superseded:
            break
        // Read by `HubRecordFold` before this fold ever sees it (`HubTranscript`), and by
        // `HubJoin` for chain ownership — never by the Session itself.
        case .recordIdentity:
            break
        case .excerpted:
            // One way only: reading the missing stretch means reading the file again, and that
            // arrives as a fresh Session rather than as more events on this one.
            transcriptExtent = .excerpt
        }
    }

    /// What someone asked for: a name where the Session has none, and a Turn opened under it.
    private mutating func observe(prompt text: String, atMs: Int?) {
        name.observe(prompt: text)
        turn.opened()
        observeActivity(atMs)
    }

    /// A call answered. The spend rides along because a delegated Turn reports its whole cost on
    /// the result of the call that delegated it, and nowhere else.
    private mutating func observe(outcome: ToolCallOutcome) {
        hasAgentActivity = true
        turn.answered(outcome.id)
        observeActivity(outcome.endedAtMs)
        spend.observe(subagent: outcome.usage)
    }

    /// What one request reported spending, and the context it left behind it.
    private mutating func observe(usage: UsageReading) {
        hasAgentActivity = true
        context = context.updated(by: usage)
        spend.observe(usage.usage)
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

    /// The extent is read where the fold has reached, not where it ended: a bounded read's seam
    /// lands mid-stream, and the moments behind it were still whole when they were observed.
    private mutating func observeActivity(_ atMs: Int?) {
        moments.observe(atMs, extent: transcriptExtent)
    }
}

/// Joining the later link of a resume-chain onto the reading its root left.
extension HubSession {
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
        observedModel = continuation.observedModel ?? observedModel
        observedEffort = continuation.observedEffort ?? observedEffort
        // The later half of the chain wins where it read one, and says nothing where it did not: a
        // resume file with no `usage` in it yet is not a Session that has emptied its context.
        context = context.merged(with: continuation.context)
        spend.merge(continuation.spend)
        branch = continuation.branch ?? branch
        // A resume is a fresh `claude` with its own flag, so the later half's stance is the live
        // one — and a file that has not stated one yet does not un-state the root's.
        observedMode = continuation.observedMode ?? observedMode
        // A chain is headless only where EVERY link is: a resume opened at a terminal continues
        // the work a `-p` run started, and what is happening to it NOW is what the Roster draws.
        if continuation.entry == .interactive {
            entry = .interactive
        }
        modeSet = continuation.modeSet ?? modeSet
        // A resume is a fresh process with its own `--model` and `--effort`, so the later half's
        // launch value is the live one (#1175).
        launchedRun = continuation.launchedRun ?? launchedRun
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
        // After the extent above, never before it: one bounded link makes the joined reading an
        // excerpt, and an excerpt withholds the earliest moment rather than guessing it.
        moments.merge(continuation.moments, extent: transcriptExtent)
        turn.merge(continuation.turn)
    }
}
