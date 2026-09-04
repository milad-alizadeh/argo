import ArgoEngine

/// What a spend reads as, in words — the two readings a feed states, at the two grains it has.
///
/// Both are spelled by `TokenCount`, which the deck header spells the same one with, so a reader
/// holding a reading against its header finds the same number in the same words. Cache is SPLIT
/// off the spend and never summed into it: `TokenCount.cached` carries why (#1177).
enum FeedSpend {
    /// The whole Session, both halves. The cache half belongs at the foot of a reading, which is
    /// the one place a reader asks what the Session as a whole has cost: the half that dwarfs the
    /// other has to be named to be discounted.
    static func sessionWords(_ usage: Usage) -> String {
        "\(TokenCount.spent(usage.spentTokens)) · \(TokenCount.cached(usage.cachedTokens))"
    }

    /// One Agent, the fresh half alone. A rail holds thirty of these at a column's width on one
    /// line each, and the Session's cache is stated once in the deck header already.
    static func agentWords(_ usage: Usage) -> String {
        TokenCount.spent(usage.spentTokens)
    }
}
