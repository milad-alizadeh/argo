/// Why a Turn ended (CONTEXT.md, "L3 · Turn").
///
/// The raw values are the hosts' own words, so parsing and printing are one table. `unknown` is the
/// honest reading of a word this vocabulary does not carry — never a guess at the nearest case.
public enum StopReason: String, Sendable, Equatable {
    case endTurn = "end_turn"
    case maxTokens = "max_tokens"
    case maxTurnRequests = "max_turn_requests"
    case refusal
    case cancelled
    case unknown
}

public extension StopReason {
    /// The host's own word, read as a reason.
    ///
    /// `tool_use` is deliberately not a case: it says the turn CONTINUES, so a record carrying it
    /// ends nothing. The reader is what keeps it out — see `TranscriptReader.turnEnd(of:)`.
    init(reported: String) {
        self = StopReason(rawValue: reported) ?? .unknown
    }
}
