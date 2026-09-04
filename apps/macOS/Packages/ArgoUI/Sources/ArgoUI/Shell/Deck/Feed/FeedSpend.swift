import ArgoEngine

/// What a spend reads as, in words.
///
/// Spelled by `TokenCount`, which the deck header spells its own reading with, so a reader holding
/// a rail against the header finds the same number in the same words. Cache is SPLIT off the spend
/// and never summed into it: `TokenCount.cached` carries why (#1177).
enum FeedSpend {
    /// One Agent, the fresh half alone. A rail holds thirty of these at a column's width on one
    /// line each, and the Session's cache is stated once in the deck header already.
    ///
    /// The one grain a feed states. The Session's whole spend belongs to the deck header, and the
    /// foot of the reading no longer says it a second time (#1248).
    static func agentWords(_ usage: Usage) -> String {
        TokenCount.spent(usage.spentTokens)
    }
}
