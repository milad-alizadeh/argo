import ArgoEngine
import ArgoFixtures
import ArgoUI

// The readings a WAIT leaves behind it, projected (#1323). Their own file rather than beside the
// rest: a wait is not the record's, so these are the one set of preview rows built from something
// other than a transcript alone.

extension FeedProjection {
    /// A reading with the start that opened it settled at its head (#1323) — what the plinth drops
    /// into the reading when the wait ends. Against real work rather than alone, because a settled
    /// row is judged by whether it reads as one more thing that happened; and against a SHORT
    /// reading, because a still cannot scroll to the head of a long one.
    static let previewSettledWaitRows = rows(
        from: TranscriptFixtures.surveyed,
        settledWaits: [SessionWaitSettled(wait: .starting, tookMs: 3200)],
    )

    /// A start that FAILED, over a run of commands one of which failed too — on purpose: a failure
    /// judged on a clean screen is not judged, and the whole claim of this row is that it is told
    /// apart from a failed call by nothing but its words.
    static let previewFailedWaitRows = rows(
        from: TranscriptFixtures.ranCommands,
        settledWaits: [
            SessionWaitSettled(
                wait: .starting,
                tookMs: 6200,
                failure: "the process exited with code 1",
            ),
        ],
    )
}
