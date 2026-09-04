/// Which admit each transcript's tail is running under.
///
/// A tail is started by `TranscriptWatch.tail(_:joining:)`, which SUSPENDS before it can register
/// the task it makes — it waits on the previous tail ending first. Two admits of one transcript
/// therefore interleave, and without a token the second one to reach the table wins the dictionary
/// while the first keeps running unreferenced: two tails reading one file, every live batch folded
/// into the reading twice, and every row of it drawn twice (#1237).
///
/// The token settles it. Every admit is stamped BEFORE the first suspension, so the last one to
/// arrive owns the id however the awaits interleave; every other one starts nothing, and every
/// drain that finishes under a stamp the id has moved past clears nothing and settles nothing.
///
/// A counter rather than the task's own identity, because the question is asked at two moments the
/// task does not span: before it exists, and after it is over.
struct TranscriptAdmissions {
    /// The admit each transcript's tail is owned by. Keyed by transcript id.
    private var owners: [String: Int] = [:]
    /// Monotonic across every transcript, so no two admits anywhere share a stamp.
    private var issued = 0

    /// Stamp a new admit of this transcript and take the id. Called before the first `await` of the
    /// admit it stamps, which is the whole of what makes the answer below meaningful.
    mutating func admit(_ transcriptID: String) -> Int {
        issued += 1
        owners[transcriptID] = issued
        return issued
    }

    /// Whether this admit still owns the transcript — false once a later one has taken it, and
    /// false for a transcript nobody is admitting any more.
    func holds(_ admission: Int, for transcriptID: String) -> Bool {
        owners[transcriptID] == admission
    }

    /// Give up a transcript's id, so nothing that was reading it may settle or clear it. What a
    /// DROPPED transcript takes; a paused one keeps its stamp, because its tail still has a
    /// reading to settle.
    mutating func forget(_ transcriptID: String) {
        owners.removeValue(forKey: transcriptID)
    }

    /// The same for every transcript at once — a teardown.
    mutating func forgetAll() {
        owners = [:]
    }
}
