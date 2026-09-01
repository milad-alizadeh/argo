/// How much of a reader's browsing is remembered, in one place for the three stores that remember
/// it: the transcripts held read whole (`WholeReadings`), the readings projected off them
/// (`SessionsRoomReadingCache`), and the row heights measured for each (`FeedGeometries`). All
/// three remember the SAME browsing, so a ceiling that differed between them would evict a reading
/// the other two still hold.
public enum ReadingCeilings {
    /// How many readings are remembered. Twenty, which is what the reader asked for and what a
    /// week-wide roster makes reasonable: at four, browsing six Sessions re-derived two of them.
    public static let readings = 20

    /// The size ceiling under the count, because twenty readings are not a fixed size (ADR-0028
    /// Rule 4). Measured against the week `TranscriptExcerpt` was sized against: a held reading
    /// costs about 0.6 KB per event, the twenty largest transcripts there hold 94 361 events and
    /// settle at 256 MB resident, and the whole week is 197 876. So a hundred thousand admits that
    /// worst case and would evict a worse one, while an ordinary twenty — nearer 29 000 — leaves
    /// the count binding and never reaches this.
    ///
    /// Events rather than file bytes, because a file's bytes do not say how many events are in it:
    /// one event per 5.9 KB in the largest transcripts here and one per 2.3 KB across the week. A
    /// projected reading holds roughly one row per event, which is why the same number bounds rows.
    ///
    /// What no ceiling here bounds is the DRAIN: `FileCursor.drain` reads a whole file in one
    /// `readToEnd`, so a large transcript peaks at roughly three times its size whatever is held.
    public static let events = 100_000
}
