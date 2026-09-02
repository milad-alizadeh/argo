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
    /// A spend is reported on EACH end, and that is the point of the fixture rather than dressing:
    /// `longTranscript` reports none anywhere, so a still built on its ends alone shows no roll-up
    /// at the foot whether the withholding is there or not. With these two, the reading a reader
    /// would have been shown is `session · 2×` what either end says.
    static let previewExcerptedRows = rows(from: excerptedEvents)

    /// The same two ends WITHOUT the seam between them — the reading whose foot does carry the
    /// roll-up, so a suite can hold the pair against each other.
    static let previewWholeOfExcerptEvents = excerptedEvents.filter { $0 != .excerpted }

    private static let excerptedEvents: [TranscriptEvent] =
        TranscriptFixtures.longTranscript.prefix(excerptEndRows)
            + [.usage(excerptEndSpend), .excerpted]
            + TranscriptFixtures.longTranscript.suffix(excerptEndRows)
            + [.usage(excerptEndSpend)]

    /// Rows per end — a bit over one turn each way, which is enough that the seam is read between
    /// work rather than at the top of an otherwise empty column.
    private static let excerptEndRows = 16

    /// What one end of that record reported spending. One value on both ends, so the total a
    /// reader must NOT be shown is exactly double it — the easiest wrong number to recognise in a
    /// still.
    private static let excerptEndSpend = Usage(
        inputTokens: 4000,
        outputTokens: 500,
        cacheReadTokens: 20000,
        cacheCreationTokens: 0,
    )
}
