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
    /// What this Session said over the companion channel, where it has one. Absent for every
    /// external Session and for a managed one whose agent has not spoken — which is not a degrade,
    /// only the tier having nothing to say yet.
    public internal(set) var convention: CompanionReport?
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
    /// The newest moment the records report, where they report one.
    public private(set) var lastActivityAtMs: Int?
    /// The oldest, which is when this Session started — the fact a claim window is matched against.
    public private(set) var startedAtMs: Int?
    /// The file's own last write, behind it — what a transcript whose records carry no time still
    /// has to say about when it ran.
    private var recordedAtMs: Int?
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
        self.lastActivityAtMs = spawn.exit?.atMs ?? spawn.spawnedAtMs
        self.startedAtMs = spawn.spawnedAtMs
        self.lastStop = spawn.exit == nil ? .endTurn : .cancelled
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
            turnOpen = false
            lastStop = reason
            // A question the Turn it was asked in has left behind is not still waiting on anyone.
            pendingAsks = []
        case let .toolCall(call):
            if call.name == ToolCall.askUserQuestion {
                pendingAsks.insert(call.id)
            }
            observeActivity(call.atMs)
        case let .toolCallOutcome(outcome):
            pendingAsks.remove(outcome.id)
            observeActivity(outcome.endedAtMs)
        case let .compaction(atMs):
            observeActivity(atMs)
        case .message, .thought, .plan, .usage, .unreadableLine:
            break
        }
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
        // Appended, not merged: a resume chain is walked root-first, so the continuation's stream
        // is the later half of one reading and belongs behind what came before it.
        events += continuation.events
        cwd = continuation.cwd ?? cwd
        model = continuation.model ?? model
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
