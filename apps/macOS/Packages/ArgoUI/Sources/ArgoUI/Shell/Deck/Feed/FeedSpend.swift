import ArgoEngine

/// What a spend reads as, in words.
///
/// One place, because two surfaces say it — the rail's chips and the reading's own roll-up.
///
/// The UNIT is part of the reading and never dropped: a bare `143.6K` could be tokens, dollars or
/// lines.
enum FeedSpend {
    /// Every token the record attributed to the work — what was sent, what came back, and the cache
    /// either way.
    static func total(_ usage: Usage) -> Int {
        usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
    }

    /// The figure with its unit on it. Rounded once it passes a thousand, because the exact count
    /// of a hundred thousand tokens is precision nobody reads and width the row cannot spare.
    static func words(_ usage: Usage) -> String {
        "\(figure(total(usage))) tokens"
    }

    private static func figure(_ tokens: Int) -> String {
        switch tokens {
        case ..<1000: "\(tokens)"
        case ..<1_000_000: rounded(Double(tokens) / 1000, "K")
        default: rounded(Double(tokens) / 1_000_000, "M")
        }
    }

    private static func rounded(_ value: Double, _ scale: String) -> String {
        String(format: "%.1f", value) + scale
    }
}
