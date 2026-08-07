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
    /// When the agent emitted the call.
    public let atMs: Int?
}

/// A call's resolution: everything the answering `tool_result` record said about it.
///
/// Separate from `ToolCall` rather than mutable fields on it, because the two are read from two
/// different records that can be arbitrarily far apart in the file — and in a stream, the second
/// one is a later event, not a retroactive edit to the first.
public struct ToolCallOutcome: Sendable, Equatable {
    public let id: String
    public let status: ToolCallStatus
    /// What the call produced, or `nil` for a result of a kind nothing reads.
    public let result: ToolResult?
    /// When its result came back, so a call has a duration and not just a moment.
    public let endedAtMs: Int?
    /// What the call itself reported spending. `nil` for the ordinary call, which spends nothing of
    /// its own — a DELEGATING call is the case this exists for: its result carries the whole spend
    /// of the subagent it ran, which is the only place that spend is ever visible.
    public let usage: Usage?
}
