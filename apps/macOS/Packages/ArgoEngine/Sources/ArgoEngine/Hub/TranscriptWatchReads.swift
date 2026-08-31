/// How many transcripts one watch has opened, at each extent.
///
/// A COUNT and not a duration, because a count is exactly the same on an idle machine and on a
/// loaded one, and under `-Onone` and `-O` alike (ADR-0028 Rule 8). Two claims ride on it, and both
/// are what ADR-0008 used to hold by keeping the working-set window narrow:
///
/// - a launch sweep opens NOTHING whole, however many transcripts the week admits; and
/// - selecting one Session opens its file exactly once, however many times it is clicked.
///
/// Per watch rather than per process: a watch is one Hub's reading, so a suite's own figure cannot
/// be inflated by whatever else is running beside it.
struct TranscriptWatchReads: Equatable {
    /// Files opened to be read WHOLE — one per Session selected, and never a second for one whose
    /// reading is still held (`WholeReadings`).
    private(set) var whole = 0
    /// Files opened on a bounded read of their two ends — one per transcript per sweep.
    private(set) var excerpt = 0

    mutating func opened(_ extent: SessionTranscriptExtent) {
        switch extent {
        case .whole: whole += 1
        case .excerpt: excerpt += 1
        }
    }
}
