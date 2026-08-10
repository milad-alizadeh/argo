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
    ///
    /// Meaningful only on ONE reported spend. Summed `Usage` values are what a Session has BILLED,
    /// and every request re-sends the conversation, so this taken off a roll-up would count the
    /// same window once per turn.
    public var contextTokens: Int {
        tokens
    }

    /// What a spend COST — the same four terms, answering the other question.
    ///
    /// The arithmetic is `contextTokens`'; the READING is its opposite. That one is meaningful
    /// only on a single reported spend, and this one only on a roll-up: a Session's bill is every
    /// request it made, conversation re-sent each time and cache included. Two names because a
    /// number used for the wrong one of those two questions is wrong by a factor of the turn count.
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

    /// The cache half of the same bill — read and written, both cheaper tokens. Split out so a
    /// roll-up can say `2.1M tokens spent · 73.7M cached` instead of one number read as fresh
    /// spend.
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
