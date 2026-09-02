import ArgoEngine

extension [TranscriptEvent] {
    /// Whether this reading has a HOLE in it — the seam a bounded launch read leaves between a
    /// transcript's two ends (`TranscriptExcerpt`).
    ///
    /// The one predicate three surfaces withhold a figure on: the feed's spend roll-up
    /// (`FeedProjection.rolledUp`), and the header's spend and worked totals
    /// (`SessionHeaderProjection+Spend`). A sum over two ends leaves out whatever the missing
    /// stretch spent, and each of those renders it as a whole figure.
    ///
    /// Read off the seam's own EVENT rather than off `HubSession.transcriptExtent`, which no
    /// surface is handed.
    var isBoundedReading: Bool {
        contains(.excerpted)
    }
}
