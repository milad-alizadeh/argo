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

    /// How much context ONE request was made against, all four terms — a cached read is a cheaper
    /// token, not a smaller one.
    ///
    /// Meaningful only on ONE reported spend: every request re-sends the conversation, so this
    /// taken off a roll-up would count the same window once per turn.
    public var contextTokens: Int {
        tokens
    }

    /// What a spend COST — the same arithmetic as `contextTokens`, the opposite reading. Meaningful
    /// only on a ROLL-UP. Two names because a number used for the wrong one of those two questions
    /// is wrong by a factor of the turn count.
    public var billedTokens: Int {
        tokens
    }

    private var tokens: Int {
        inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens
    }

    /// The fresh half of a bill: what was sent and what came back, cache excluded. On a roll-up
    /// this is the figure a reader means by "used" — every request re-reads the whole conversation
    /// from cache, so the cache terms dwarf this by the turn count while costing a fraction of it.
    public var spentTokens: Int {
        inputTokens + outputTokens
    }

    /// The cache half of the same bill — read and written, both cheaper tokens.
    public var cachedTokens: Int {
        cacheReadTokens + cacheCreationTokens
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
