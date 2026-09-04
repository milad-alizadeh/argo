/// How much of one read the join takes under a single write, before it hands the main actor back.
///
/// A tail delivers what a file already held as ONE batch, so the size of the first batch is the
/// size of the file, and taking it under one write holds the main actor for as long as that takes.
/// Slicing bounds the hold by a COUNT rather than by the file (ADR-0028 Rule 1): the main actor is
/// handed back between slices, so the roster answers and a frame can be drawn while a long read is
/// still landing.
///
/// **It is not where #1166's two seconds are**, and the measurement that says so is
/// `PerfBudgets.foldSlice`: they are the READ, off the main actor, which this does not touch. What
/// this bounds is the one part of that path that grew with the file.
///
/// A COUNT of events rather than a span of milliseconds, for `TranscriptWatchReads`' reason: a
/// count is exactly the same on an idle machine and on a loaded one (ADR-0028 Rule 8). Events
/// rather than bytes for `ReadingCeilings.events`' reason — a file's bytes do not say how many
/// events are in it, and the work bounded here is per event.
enum TranscriptSlice {
    /// Two hundred, which is about 0.15 ms at the figures recorded beside them — an order of
    /// magnitude inside a frame, so no slice can drop one, and far enough above an ordinary live
    /// batch of a record or two that a tail keeping up with an agent still lands in one write.
    static let events = 200
}
