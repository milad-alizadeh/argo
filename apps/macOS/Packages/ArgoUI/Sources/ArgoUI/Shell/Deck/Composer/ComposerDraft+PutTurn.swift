/// The Turn a put follow-up starts, and the wait for the record to show it (#1238, #1337).
///
/// Its own file rather than either caller's, because it has two: `flush(via:)` puts one follow-up
/// at the boundary and `steerLanded(_:)` puts one through an interrupt, and both leave exactly
/// this behind. Kept beside neither, so neither reads as the owner of a claim they share.
extension ComposerDraft {
    // Whether a Turn this composer PUT is still waiting to be seen by the record (#1238, #1337).
    //
    // It answers the one place the status is not merely stale but actively WRONG. `hasTurnEnded`
    // is DERIVED off the record, and both ways a follow-up goes leave it reading `true` over a
    // Turn that has started: a steer's own interrupt ended the Turn before it, and a boundary
    // release is made at a reading where the Turn had genuinely ended. A release asked in that
    // window sees a Session at rest with a queue waiting on it, and empties the whole queue into
    // the Turn Argo has just started.
    //
    // So the claim stands until the record shows a Turn RUNNING again, and the boundary after
    // that one is what releases what is left.

    /// Whether a put Turn is still waiting to be seen by the record. What `ComposerRelease` reads,
    /// so no release is made on a status that has not caught up with Argo's own act.
    var isAwaitingPutTurn: Bool {
        putAwaitingRecord
    }

    /// Say that a put has started a Turn, so nothing is released until the record has seen it.
    mutating func claimPutTurn() {
        putAwaitingRecord = true
    }

    /// The record shows a Turn running, so the claim above is spent: the put Turn is one the
    /// status can now be read for, and its own boundary is what releases what is still queued.
    ///
    /// Spent on the Turn STARTING and not on the boundary, because the boundary is exactly what
    /// the stale reading was already claiming — waiting for one would spend the claim on the
    /// reading it exists to distrust.
    mutating func turnStarted() {
        putAwaitingRecord = false
    }
}
