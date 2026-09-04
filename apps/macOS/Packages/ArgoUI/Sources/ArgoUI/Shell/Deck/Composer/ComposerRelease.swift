import ArgoEngine

/// Whether what is waiting on a Turn may go NOW, read off one Session and one draft (#1238).
///
/// A LEVEL and not an edge, which is the whole of what this type is for. One edge is one chance:
/// whatever consumes it — a walk holding the release, a standing refusal, a boundary that fired at
/// a pause the Turn came back from — strands the queue with nothing left to try it again. So the
/// composer asks this at every movement in `Awaiting`, as well as at the boundary.
struct ComposerRelease {
    /// What the draft brings to the decision, as one `Equatable` value the vessel can watch.
    ///
    /// The Session's side is deliberately NOT in here. A boundary carries out its own release, and
    /// it has a once-per-Turn claim to spend first (`ComposerDraft.mustDropQueue(afterInterrupt:)`)
    /// — a level watching the boundary too would race that drop with a flush of the very
    /// follow-ups it is about to take away.
    struct Awaiting: Equatable {
        /// How many follow-ups are waiting. A count and not the turns themselves: what the release
        /// reads is whether there is anything to put, and the words are the draft's own business.
        let waiting: Int
        /// A rung waiting on the same boundary (#940).
        let heldMode: SessionMode?
        /// Whether a walk is already under way, which no second reading may start another of
        /// (#653).
        let isWalkingMode: Bool
        /// Whether a refusal is standing over the draft.
        let isRefused: Bool

        init(_ draft: ComposerDraft) {
            self.waiting = draft.queued.count
            self.heldMode = draft.heldMode
            self.isWalkingMode = draft.isWalkingMode
            self.isRefused = draft.refusal != nil
        }
    }

    /// Whether the Turn the queue is waiting on is over — `SessionComposerProjection.hasTurnEnded`.
    let hasTurnEnded: Bool
    let awaiting: Awaiting

    init(_ composer: SessionComposerProjection.Composer, _ draft: ComposerDraft) {
        self.hasTurnEnded = composer.hasTurnEnded
        self.awaiting = Awaiting(draft)
    }

    /// Whether the held rung may be walked now. Ahead of `flushes` in the order the composer acts,
    /// for the reason `SessionComposer.honour(_:)` states.
    var walks: Bool {
        hasTurnEnded && awaiting.heldMode != nil && !awaiting.isWalkingMode
    }

    /// Whether the queue may be put now.
    ///
    /// A standing refusal STOPS it, and that is what makes the level safe: a refused release is
    /// the reader's to answer with Retry (decision 8), and without this the same words would go to
    /// the same port again at every reading of the Session.
    ///
    /// A walk in flight stops it too — it ends in a release of its own, and a second one racing it
    /// would deliver the follow-up under the stance the walk was moving away from.
    var flushes: Bool {
        hasTurnEnded && awaiting.waiting > 0 && !awaiting.isRefused && !awaiting.isWalkingMode
    }
}
