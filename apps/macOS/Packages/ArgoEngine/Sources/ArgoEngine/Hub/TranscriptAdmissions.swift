/// Which admit each transcript's tail is running under.
///
/// A tail is started by `TranscriptWatch.tail(_:joining:)`, which SUSPENDS before it can register
/// the task it makes — it waits on the previous tail ending first. Two admits of one transcript
/// therefore interleave, and without a stamp the second one to reach the table wins the dictionary
/// while the first keeps running unreferenced: two tails reading one file, and every row of it
/// drawn twice (#1237).
///
/// The stamp settles it. Every admit is stamped BEFORE the first suspension, so the last one to
/// arrive owns the id however the awaits interleave; every other one starts nothing, and every
/// drain that finishes under a stamp the id has moved past clears nothing and settles nothing.
struct TranscriptAdmissions {
    /// One admit of one transcript. Opaque and comparable only to itself, so nothing can pass a
    /// number that happens to be in scope where the owning admit is asked for.
    struct Admission: Equatable {
        fileprivate let stamp: Int
    }

    /// The admit each transcript's tail is owned by. Keyed by transcript id.
    private var owners: [String: Admission] = [:]
    /// Monotonic across every transcript, so no two admits anywhere share a stamp.
    private var issued = 0

    /// Stamp a new admit of this transcript and take the id. Called before the first `await` of the
    /// admit it stamps, which is the whole of what makes `owns` meaningful.
    mutating func stamp(_ transcriptID: String) -> Admission {
        issued += 1
        let admission = Admission(stamp: issued)
        owners[transcriptID] = admission
        return admission
    }

    /// Whether this admit still owns the transcript — false once a later one has taken it, and
    /// false for a transcript nobody is admitting any more.
    func owns(_ admission: Admission, _ transcriptID: String) -> Bool {
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
