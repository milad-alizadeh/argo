import ArgoEngine

/// What a spend reads as, in words.
///
/// One place, because two surfaces say it — the rail's chips and the reading's own roll-up.
///
/// Cache is SPLIT OFF the spend and never summed into it, which is the rule the deck header
/// already keeps (`SessionHeaderProjection.spend`). Every request re-reads the whole conversation
/// from cache, so a figure that sums the four fields counts the same context once per Turn: it
/// grows with the number of REQUESTS rather than with the work, and reached `2.3M tokens` at the
/// foot of a reading whose context gauge read `79.9k / 1M` (#1177).
///
/// The words and the figures are the header's own — `TokenCount.short`, `tokens spent`, `cached`
/// — so a reader holding the two readings side by side finds the same number spelled the same way.
/// The UNIT is part of every reading and never dropped: a bare `143.6k` could be tokens, dollars
/// or lines.
enum FeedSpend {
    /// The whole Session, both halves. The roll-up at the foot of a reading, where the cache half
    /// belongs: it is the one place a reader asks what the Session as a whole has cost, and the
    /// half that dwarfs the other is the half that has to be named to be discounted.
    static func session(_ usage: Usage) -> String {
        "\(agent(usage)) · \(TokenCount.short(usage.cachedTokens)) cached"
    }

    /// One Agent, the fresh half alone.
    ///
    /// Deliberately NOT the split (#1177). A Subagent's reported usage is itself a roll-up over its
    /// own requests, so the sum would be wrong here for exactly the reason it was wrong at the foot
    /// of the reading — but the cache half is not worth a chip's width either. The rail holds
    /// thirty of these at a column's width on one line each, and the Session's cache is already
    /// stated once in the deck header: restating it thirty times down a rail buys nothing and
    /// truncates the figure a reader came for.
    static func agent(_ usage: Usage) -> String {
        "\(TokenCount.short(usage.spentTokens)) tokens spent"
    }
}
