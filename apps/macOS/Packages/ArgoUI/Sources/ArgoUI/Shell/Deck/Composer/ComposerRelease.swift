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
    /// — a level watching the boundary too would race that drop with a put of the very
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
        /// Whether a follow-up is being steered into the running Turn (#1238).
        let isSteering: Bool
        /// Whether a follow-up this composer put has started a Turn the record has yet to show
        /// running — a steered one (#1238) or a released one (#1337).
        let isAwaitingPutTurn: Bool

        init(_ draft: ComposerDraft) {
            self.waiting = draft.queued.count
            self.heldMode = draft.heldMode
            self.isWalkingMode = draft.isWalkingMode
            self.isRefused = draft.refusal != nil
            self.isSteering = draft.steeringTurn != nil
            self.isAwaitingPutTurn = draft.isAwaitingPutTurn
        }
    }

    /// Whether the Turn the queue is waiting on is over — `SessionComposerProjection.hasTurnEnded`.
    let hasTurnEnded: Bool
    let awaiting: Awaiting

    init(_ composer: SessionComposerProjection.Composer, _ draft: ComposerDraft) {
        self.hasTurnEnded = composer.hasTurnEnded
        self.awaiting = Awaiting(draft)
    }

    /// Whether the held rung may be walked now. Ahead of `putsNext` in the order the composer acts,
    /// for the reason `SessionComposer.honour(_:)` states.
    var walks: Bool {
        hasTurnEnded && awaiting.heldMode != nil && !awaiting.isWalkingMode && !awaiting.isSteering
    }

    /// Whether the queue may be put now.
    ///
    /// A standing refusal STOPS it, and that is what makes the level safe: a refused release is
    /// the reader's to answer with Retry (decision 8), and without this the same words would go to
    /// the same port again at every reading of the Session.
    ///
    /// A walk in flight stops it too — it ends in a release of its own, and a second one racing it
    /// would deliver the follow-up under the stance the walk was moving away from.
    ///
    /// So does a STEER in flight, and that one is the sharpest of the three: a steer's own
    /// interrupt ENDS the Turn, so the boundary arrives while the steered follow-up is still in
    /// the queue with its paste not yet written. Released there it would go twice, and every
    /// follow-up behind it would go early, into a Turn the reader had just redirected (#1238).
    /// And a follow-up that has just GONE stops it too, which is the sharpest of the four: the
    /// paste has gone but the record has not caught up, so `hasTurnEnded` is still reading `true`
    /// for the Turn before it rather than the one it started. Released on that reading the whole
    /// queue would follow it into that Turn — which is a steer's queue emptying into the run it
    /// was redirecting (#1238), and, at the boundary, every follow-up after the first written to a
    /// CLI busy with the first (#1337).
    var putsNext: Bool {
        hasTurnEnded && awaiting.waiting > 0 && !awaiting.isRefused && !awaiting.isWalkingMode
            && !awaiting.isSteering && !awaiting.isAwaitingPutTurn
    }
}
