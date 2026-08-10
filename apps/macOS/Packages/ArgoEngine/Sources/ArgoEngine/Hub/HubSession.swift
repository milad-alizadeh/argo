import Foundation

/// The Session facts the shell can establish directly from one transcript stream.
public struct HubSession: Equatable, Identifiable, Sendable {
    public let id: String
    /// The transcript this Session was read from. Absent for one Argo has just spawned: the CLI
    /// writes no record until its first prompt, and there is no file to name until it does.
    public let sourceURL: URL?
    /// Which posture of the `managed | external` axis this Session is on. Read off the ownership
    /// registry when the Hub publishes the roster, never asserted here: a transcript file says
    /// nothing about who spawned the CLI that wrote it.
    public internal(set) var provenance: SessionProvenance = .external
    /// What Argo can see of the process behind the transcript. Set by the Hub from its own liveness
    /// read; quiet until one has been taken, because ambiguity resolves toward the quieter state.
    public internal(set) var liveness: SessionLiveness = .quiet
    /// Which agent program wrote this record (`CONTEXT.md` L2). Set by the Hub from the record
    /// store the transcript was swept out of, or DIRECT from the spawn for a Session Argo
    /// started; never guessed from the prose inside the file.
    public internal(set) var cli: AgentCLI?
    /// The git context of the Session's working directory, as of the last read. Absent until one
    /// has happened, and absent for a folder git could not answer for — an unread Workspace is
    /// not a clean one.
    public internal(set) var workspace: WorkspaceProjection?
    /// What this Session said over the companion channel, where it has one. Absent for every
    /// external Session and for a managed one whose agent has not spoken — which is not a degrade,
    /// only the tier having nothing to say yet.
    public internal(set) var convention: CompanionReport?
    /// The Session this one handed its work to, where it handed it to one — the row a reader
    /// follows to find the work continuing. Set by the Hub from its own record of the handoff,
    /// never read from a transcript: neither CLI knows anything happened, and the fresh agent's own
    /// record says only that it was opened on a brief.
    public internal(set) var handedOffTo: String?
    public private(set) var title: String
    public private(set) var cwd: String?
    public private(set) var model: String?
    public private(set) var branch: String?
    public private(set) var headLeafUUID: String?
    /// Everything the transcript said, in the order it said it — kept rather than folded away.
    ///
    /// The facts above are a fold over this stream, and a fold is lossy by construction: a roster
    /// row can be derived from the prose, and the prose can never be derived back. Every surface
    /// that reads a Session rather than counting one — the feed first — reads from here, so the
    /// stream is retained whole and nothing decides on the Hub's side which kinds are worth
    /// keeping. What a reader does not handle it ignores; what it was never given it cannot draw.
    public private(set) var events: [TranscriptEvent] = []
    /// How full the Session's context is: the tokens the LATEST reported spend was made against.
    ///
    /// The last reading rather than a sum of all of them, because this is not what the Session has
    /// SPENT — it is what it is currently holding, and every request re-sends the whole
    /// conversation. Summing would count the same context once per turn and read as a Session
    /// hundreds of times over a window it is nowhere near. It falls as well as rises for the same
    /// reason: the reading after a compaction is the compacted one, with nothing here to reset.
    ///
    /// Absent until a record carries a `usage` object at all, which is the honest gap the header
    /// renders as `unknown` rather than as an empty context.
    public private(set) var contextTokens: Int?
    /// Every spend the records reported, added with `Usage`'s own `+`. Both grains, per
    /// `CONTEXT.md` L3: the assistant records' own usage, plus whatever a delegating call reported
    /// for the subagent it ran.
    private var spend: Usage?
    /// The subagent half of it, kept separately because the header says it separately.
    private var subagentSpend: Usage?
    /// The newest moment the records report, where they report one.
    public private(set) var lastActivityAtMs: Int?
    /// The oldest, which is when this Session started — the fact a claim window is matched against.
    public private(set) var startedAtMs: Int?
    /// The file's own last write, behind it — what a transcript whose records carry no time still
    /// has to say about when it ran.
    private var recordedAtMs: Int?
    /// Whether an AGENT has ever spoken in this transcript — said something, thought, called a
    /// tool, ended a turn, or been priced. A prompt does not count: it is what was ASKED.
    ///
    /// Alone this says nothing worth acting on, because a Session that has just started has a
    /// prompt and no answer yet and is perfectly real. It earns its keep only beside `isQueued`.
    ///
    /// DIRECT for a Session Argo spawned (`init(spawn:)` sets it): Argo started that process, so
    /// the row exists because the process does.
    public private(set) var hasAgentActivity = false
    /// Whether the host wrote a `queue-operation` record here — a prompt QUEUED rather than run.
    ///
    /// With no agent output beside it, that pair is the whole of the rendering this fixes: the CLI
    /// opens a transcript per queued prompt, each holding one copy of the same words and nothing
    /// else, and the roster drew one Session once per file. Queued AND answered is an ordinary
    /// Session — the queue is how its prompt arrived, not what it is.
    public private(set) var isQueued = false
    private var hasPromptTitle = false
    private var hasExplicitTitle = false
    private(set) var turnOpen = false
    private(set) var lastStop: StopReason?
    /// The `AskUserQuestion` calls in the open Turn that no result has answered.
    private(set) var pendingAsks: Set<String> = []

    /// When this Session was last seen to run: the newest moment its records report, and behind
    /// that the file's own last write. `nil` where neither could say — which is why the roster
    /// sorts such a Session last rather than giving it a guessed time, and why liveness reads it
    /// as uncorroborated rather than as recent.
    public var lastSeenAtMs: Int? {
        lastActivityAtMs ?? recordedAtMs
    }

    /// What the Session has SPENT across its whole life — the opposite reading from
    /// `contextTokens`, which is only what it is holding now. Absent until a record prices
    /// something: a Session nobody priced has not spent nothing. Cache excluded — that figure
    /// is `cachedTokens`, split out so neither inflates the other's reading.
    public var spentTokens: Int? {
        spend?.spentTokens
    }

    /// The cache half of the same life: read and re-read once per request, so it runs to tens of
    /// millions on a long Session while the spend stays small. Absent with `spentTokens`.
    public var cachedTokens: Int? {
        spend?.cachedTokens
    }

    /// What this Session's subagents spent, read off the DELEGATING call's result — the only place
    /// that spend is ever reported, since a sidechain's own records carry none.
    ///
    /// Absent, never zero, where no delegating call reported any: every CLI in use today reports
    /// nothing here, and a zero would claim no subagent ran.
    public var subagentTokens: Int? {
        subagentSpend?.billedTokens
    }

    public init(observation: TranscriptObservation) {
        self.id = observation.id
        self.sourceURL = observation.sourceURL
        self.title = observation.sourceURL.deletingPathExtension().lastPathComponent
        self.recordedAtMs = observation.modifiedAt?.epochMs
    }

    /// The row for an agent Argo has just STARTED, before the CLI has written a record.
    ///
    /// Waiting for the transcript would render a DIRECT fact — Argo owns this claim and its PTY —
    /// at the DERIVED tier's latency, leaving the roster silent about the one Session it knows for
    /// certain (#361). Its id IS the claim's, because that is the only handle the spawn and the
    /// terminal share until the CLI picks one.
    ///
    /// Idle, not running: the agent is up and has been asked nothing, which is the state that hands
    /// the next move back to you. That is what the stop reason spells — a spawn IS a boundary, with
    /// no Turn in progress on either side of it — and it is a DIRECT fact about a process Argo
    /// started, not a reading of a record that does not exist. Left absent, the same row would read
    /// `unknown` until the liveness poll caught up and then `running` over an agent sitting at its
    /// prompt.
    ///
    /// A PTY that goes without a record ever appearing closes that Turn `cancelled`; the `ended`
    /// the roster then shows comes from the orphaned provenance, never from a reason invented here.
    init(spawn: AgentSpawn) {
        self.id = spawn.claim.value
        self.sourceURL = nil
        self.title = spawn.title
        self.cwd = spawn.cwd
        // DIRECT: Argo chose this program and started it.
        self.cli = spawn.cli
        self.lastActivityAtMs = spawn.exit?.atMs ?? spawn.spawnedAtMs
        self.startedAtMs = spawn.spawnedAtMs
        self.lastStop = spawn.exit == nil ? .endTurn : .cancelled
        // Argo started this process, so the row is DIRECT and belongs on the roster from the moment
        // it exists — waiting for the agent to answer would hide the Session somebody just spawned.
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
            title = observedTitle
            hasExplicitTitle = true
        case let .cwd(observedCwd):
            cwd = observedCwd
        case let .model(observedModel):
            model = observedModel
        case let .branch(observedBranch):
            branch = Self.branchName(observedBranch)
        case let .prompt(text, atMs):
            applyPromptTitle(text)
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
        // claim `hasAgentActivity` is about, so it deliberately does not count.
        case .unreadableLine:
            break
        }
    }

    /// A delegating call's result is where a subagent's whole spend arrives, so it counts twice:
    /// once as this Session's own subagent line, and once into what the Session has spent
    /// altogether. A call that reported nothing leaves both absent rather than adding a zero.
    private mutating func observeSubagentSpend(_ usage: Usage?) {
        guard let usage else { return }
        subagentSpend = Self.summed(subagentSpend, usage)
        spend = Self.summed(spend, usage)
    }

    /// What a transcript's branch field is worth reading as a branch.
    ///
    /// A detached checkout makes the CLI write the literal `HEAD`, which is not a ref anybody can
    /// check out. Read at the point the fact enters the Hub rather than at each surface that draws
    /// it, so no reader has to know the convention to avoid rendering an absence as a word.
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
        if continuation.hasExplicitTitle {
            title = continuation.title
            hasExplicitTitle = true
        } else if !hasExplicitTitle, !hasPromptTitle, continuation.hasPromptTitle {
            title = continuation.title
            hasPromptTitle = true
        }
        // Either half having seen the agent speak is the whole chain having seen it: a resume file
        // opened and not yet answered does not un-run the reading it continues.
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
        headLeafUUID = continuation.headLeafUUID ?? headLeafUUID
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

    private mutating func applyPromptTitle(_ text: String) {
        guard !hasExplicitTitle, !hasPromptTitle,
              let firstLine = text.split(whereSeparator: \.isNewline).first
        else { return }
        let candidate = String(firstLine).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return }
        title = candidate
        hasPromptTitle = true
    }
}
