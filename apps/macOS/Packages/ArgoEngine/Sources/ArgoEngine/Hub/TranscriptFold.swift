/// How much of one read the join folds under a single write, before it hands the main actor back.
///
/// A tail delivers what a file already held as ONE batch, so the size of the first batch is the
/// size of the file, and folding it under one write holds the main actor for as long as the fold
/// takes. Slicing it bounds that hold by a COUNT rather than by the file (ADR-0028 Rule 1): the
/// main actor is handed back between slices, so the roster answers and a frame can be drawn while
/// a long read is still landing.
///
/// **What this is not.** #1166 reported about two seconds between the click and the feed, and its
/// diagnosis put them here. They are not here: at 4 801 events over 60 MB the whole batch folds in
/// 3.6 ms and the same read takes 0.70 s wall, so the wait is the READ — `readToEnd` and the parse
/// behind it, both off the main actor — and slicing the fold does not shorten it. What slicing
/// fixes is the one thing here that grew with the file, before it grew past a frame. The figures
/// are `PerfBudgets.foldSlice`.
///
/// A COUNT of events rather than a span of milliseconds, for `TranscriptWatchReads`' reason: a
/// count is exactly the same on an idle machine and on a loaded one (ADR-0028 Rule 8). Events
/// rather than bytes for `ReadingCeilings.events`' reason — a file's bytes do not say how many
/// events are in it, and the fold's work is per event.
enum TranscriptFold {
    /// Two hundred, which is about 0.15 ms of fold at the figures above — an order of magnitude
    /// inside a frame, so no slice can drop one, and far enough above an ordinary live batch of a
    /// record or two that a tail keeping up with an agent still lands in one write.
    static let events = 200
}
