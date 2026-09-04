import ArgoEngine
import ArgoFixtures
import ArgoUI

// The one reading in this catalog with a HOLE in it, kept apart from the whole ones: what a
// bounded launch read leaves behind (`TranscriptExcerpt`).

extension FeedProjection {
    /// The reading a bounded launch read leaves: a transcript's opening records, the seam where its
    /// middle is missing, and its newest ones (`TranscriptExcerpt`).
    ///
    /// Assembled rather than filtered, because no fixture stream can be excerpted — the seam is a
    /// fact about how many BYTES were read, and every fixture here is handed to the projection
    /// whole.
    ///
    /// A spend is reported on EACH end, so the reading carries the two figures a record read in two
    /// halves really does report. No feed row sums them: the deck header is the one surface that
    /// states a Session's spend (#1248).
    static let previewExcerptedRows = rows(from: excerptedEvents)

    private static let excerptedEvents: [TranscriptEvent] =
        TranscriptFixtures.longTranscript.prefix(excerptEndRows)
            + [.usage(excerptEndSpend), .excerpted]
            + TranscriptFixtures.longTranscript.suffix(excerptEndRows)
            + [.usage(excerptEndSpend)]

    /// Rows per end — a bit over one turn each way, which is enough that the seam is read between
    /// work rather than at the top of an otherwise empty column.
    private static let excerptEndRows = 16

    /// What one end of that record reported spending. One value on both ends, so a surface that
    /// wrongly sums the two halves reads exactly double it — the easiest wrong number to recognise
    /// in a still.
    private static let excerptEndSpend = Usage(
        inputTokens: 4000,
        outputTokens: 500,
        cacheReadTokens: 20000,
        cacheCreationTokens: 0,
    )
}
