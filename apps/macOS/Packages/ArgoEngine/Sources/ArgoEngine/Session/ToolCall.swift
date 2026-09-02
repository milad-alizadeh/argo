/// What the tool did, coarse enough to be CLI-agnostic. The host's own tool name travels verbatim
/// beside it, so nothing the host said is renamed away.
public enum ToolCallKind: String, Sendable, Equatable {
    case read
    case edit
    case execute
    case search
    case fetch
    case delegate
    case plan
    /// A packaged set of instructions the agent invoked by name. Not an `execute`: what it returns
    /// is the instructions themselves, a body of prose and not a command's output.
    case skill
    /// A tool the session reached over MCP. Read from the host's own naming convention, never from
    /// what the tool does: a server's tools are arbitrary, and only the name says where they came
    /// from.
    case mcp
    case other
}

public enum ToolCallStatus: String, Sendable, Equatable {
    case pending
    case inProgress
    case completed
    case failed
}

/// The atomic observable action within a Turn — the unit users watch scroll by.
///
/// Opened `pending`, which is the honest opening state: the matching `tool_result` has not been
/// read yet, and it may never arrive at all if the turn was interrupted.
public struct ToolCall: Sendable, Equatable {
    public let id: String
    /// The host's own tool name, never normalized.
    public let name: String
    public let kind: ToolCallKind
    /// The file or command the call names, when it names one.
    public let target: String?
    /// The agent's own account of what this call was for, where the host asked it for one.
    ///
    /// A fact of its own and never the target: the two are read from different keys, so a command
    /// keeps the command AND the sentence about it. DERIVED and held verbatim — the narrations are
    /// imperative-present and nothing re-tenses them. `nil` where the host wrote none, which is
    /// every call on a CLI that narrates nothing.
    public let narration: String?
    /// When the agent emitted the call.
    public let atMs: Int?
    /// The question this call put, for the one tool whose input IS a question. `nil` for every
    /// other call, and for an `AskUserQuestion` whose input carried no readable question — such a
    /// call is still a call, and no question is invented for it.
    public let ask: Ask?

    public init(
        id: String,
        name: String,
        kind: ToolCallKind,
        target: String?,
        narration: String? = nil,
        atMs: Int?,
        ask: Ask? = nil,
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.target = target
        self.narration = narration
        self.atMs = atMs
        self.ask = ask
    }

    /// The host's own name for the structured question. Matched verbatim, because the tool name IS
    /// how a record distinguishes a question that BLOCKS from one the agent merely typed out.
    public static let askUserQuestion = "AskUserQuestion"
}

/// A call's resolution: everything the answering `tool_result` record said about it.
///
/// Separate from `ToolCall` rather than mutable fields on it, because the two are read from two
/// different records that can be arbitrarily far apart in the file — and in a stream, the second
/// one is a later event, not a retroactive edit to the first.
public struct ToolCallOutcome: Sendable, Equatable {
    /// How the call finished, as the answering record put it: the state it came to rest in, what it
    /// produced, and when it came back.
    public struct Resolution: Sendable, Equatable {
        public let status: ToolCallStatus
        /// What the call produced, or `nil` for a result of a kind nothing reads.
        public let result: ToolResult?
        /// When its result came back, so a call has a duration and not just a moment.
        public let endedAtMs: Int?

        public init(status: ToolCallStatus, result: ToolResult?, endedAtMs: Int?) {
            self.status = status
            self.result = result
            self.endedAtMs = endedAtMs
        }
    }

    /// What a DELEGATING call reported about the Subagent it ran — the spend, the id and the
    /// duration the host measured for that run. All three are absent on an ordinary call, which
    /// reports nothing of its own, and each is the only place its figure is ever visible.
    public struct Delegated: Sendable, Equatable {
        /// What the call itself reported spending: the whole spend of the subagent it ran.
        public let usage: Usage?
        /// The Subagent this call started. The join key onto that Subagent's own transcript, which
        /// the host names for this string — see `SubagentTranscripts`. Unlike `usage` it is read
        /// whatever the record's own sidechain flag says: the spend is nil'd there to stop a
        /// nested delegation being billed twice, and an id is not summed.
        public let subagentID: String?
        /// How long the call itself reported taking, in milliseconds.
        ///
        /// Not `endedAtMs - atMs`: those are the PARENT's two clock readings, and a resumed chain
        /// or a record with no timestamp leaves that subtraction with nothing to work from.
        public let reportedDurationMs: Int?

        public init(usage: Usage?, subagentID: String? = nil, reportedDurationMs: Int? = nil) {
            self.usage = usage
            self.subagentID = subagentID
            self.reportedDurationMs = reportedDurationMs
        }
    }

    public let id: String
    // Flat, so a reader of one fact does not walk a group to reach it. Each is documented on the
    // `Resolution` or `Delegated` slot the initializer takes it from.
    public let status: ToolCallStatus
    public let result: ToolResult?
    public let endedAtMs: Int?
    public let usage: Usage?
    public let subagentID: String?
    public let reportedDurationMs: Int?

    public init(id: String, resolution: Resolution, delegated: Delegated) {
        self.id = id
        self.status = resolution.status
        self.result = resolution.result
        self.endedAtMs = resolution.endedAtMs
        self.usage = delegated.usage
        self.subagentID = delegated.subagentID
        self.reportedDurationMs = delegated.reportedDurationMs
    }
}
