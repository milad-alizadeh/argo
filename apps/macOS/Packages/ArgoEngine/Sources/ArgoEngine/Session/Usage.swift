/// Token telemetry, DERIVED. A fact on a Turn and on a Subagent, rolled up to the Session.
public struct Usage: Sendable, Equatable {
    public let inputTokens: Int
    public let outputTokens: Int
    public let cacheReadTokens: Int
    public let cacheCreationTokens: Int

    public init(
        inputTokens: Int,
        outputTokens: Int,
        cacheReadTokens: Int,
        cacheCreationTokens: Int,
    ) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.cacheReadTokens = cacheReadTokens
        self.cacheCreationTokens = cacheCreationTokens
    }

    /// How much context ONE request was made against: everything that went into the window plus
    /// what came back out of it.
    ///
    /// All four terms, cache included. A cached read is a cheaper token, not a smaller one — the
    /// model still reads it — so a reading that dropped the cache would report a Session at a
    /// fraction of the window it is actually filling, which for a long agent run is nearly all of
    /// it.
    public var contextTokens: Int {
        inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens
    }

    public static func + (left: Usage, right: Usage) -> Usage {
        Usage(
            inputTokens: left.inputTokens + right.inputTokens,
            outputTokens: left.outputTokens + right.outputTokens,
            cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
            cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
        )
    }
}
