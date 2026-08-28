import ArgoEngine

/// Which of a ticket's labels a backlog row draws, and how many it could not.
///
/// One answer for the chips and for what a screen reader is told, because two readings of the same
/// row disagreeing is exactly the bug it would hide: the pixels stop at
/// `ArgoBacklogList.labelLimit`
/// and speech has no width, so speech taken straight off `labels` announces marks nobody can see.
struct BacklogRowLabels: Equatable {
    /// The labels the row draws, in the provider's own order.
    let shown: [TicketLabel]
    /// How many it left, and `0` where it left none. COUNTED and not listed: the row has no width
    /// for the rest, and a number is the honest thing to say about marks it is not drawing.
    let overflow: Int

    init(_ labels: [TicketLabel], limit: Int = ArgoBacklogList.labelLimit) {
        self.shown = Array(labels.prefix(limit))
        self.overflow = max(0, labels.count - shown.count)
    }

    /// What the overflow marker reads, and `nil` where there is nothing over. The chips say `+2`
    /// and the announcement says `2 more`: the same fact, each in its own register.
    var marker: String? {
        overflow > 0 ? "+\(overflow)" : nil
    }

    /// The labels as a screen reader hears them — the drawn ones, then the count of the rest, so
    /// speech and pixels answer the same question the same way.
    var spoken: [String] {
        let words = shown.map(\.name)
        return overflow > 0 ? words + ["\(overflow) more"] : words
    }
}
