/// The Turn a put follow-up starts, and the wait for the record to show it (#1238, #1337).
///
/// Its own file because it has two callers — `putNext(via:)` at the boundary and
/// `steerLanded(_:)` through an interrupt — and neither owns it.
extension ComposerDraft {
    /// Whether a Turn this composer put is still waiting to be seen by the record. What
    /// `ComposerRelease` reads, so no release is made on a status that has not caught up with
    /// Argo's own act: `hasTurnEnded` is DERIVED off the record, so it goes on reading `true` over
    /// a Turn Argo has just started, and a release made there puts the next follow-up to a CLI
    /// already busy.
    var isAwaitingPutTurn: Bool {
        putTurnsAwaitingRecord > 0
    }

    /// Say that a put has started a Turn, so nothing is released until the record has seen it.
    mutating func claimPutTurn() {
        putTurnsAwaitingRecord += 1
    }

    /// The record shows a Turn running, so the claim is spent: the put Turn is one the status can
    /// now be read for, and its own boundary is what releases what is still queued.
    ///
    /// Spent on the Turn STARTING and not on the boundary, because the boundary is exactly what
    /// the stale reading was already claiming.
    mutating func turnStarted() {
        putTurnsAwaitingRecord = 0
    }

    /// The wait ran out and no Turn was ever read running (#1337).
    ///
    /// A put whose Turn the record never shows would hold the queue for ever — a very short Turn
    /// nothing observed, a Turn the CLI never heard (#682), a status that went straight to
    /// `stopped`. The claim exists to distrust a stale reading, not to outlive one, so it is
    /// given a bounded time and then spent: `SessionComposer.watchPut(patience:)` does the
    /// waiting, and spending this is itself a movement the release is asked at again.
    ///
    /// It says nothing on the seam. Nothing is known to have gone wrong — the Turn may simply
    /// have come and gone between two readings — and a line claiming otherwise would be a false
    /// DIRECT.
    mutating func putTurnDidNotAppear() {
        turnStarted()
    }
}
