import ArgoEngine

/// Putting one waiting follow-up into the Turn it is waiting on, instead of waiting.
///
/// The queue's ordinary promise is that a follow-up goes at the boundary (design decision 4). A
/// steer is the reader saying this one cannot wait for it — the same thing they would do at the
/// terminal with `ESC` and a sentence, which is exactly what the port does for it
/// (`SessionDriver.steer(_:attaching:to:)`).
///
/// Its own file for the reason `ComposerDraft+Mode.swift` is one: everything here is about ONE
/// follow-up overtaking the boundary, where the rest of the draft is about what waits for it.
///
/// Two halves and not one act, because the port's is `async` and a `mutating` method cannot hold a
/// draft open across the wait — the same shape `modeHeld(_:)` and `modeLanded(_:)` take.
extension ComposerDraft {
    /// Take the interrupt, and answer with the follow-up whose words are to be put — `nil` where
    /// there is nothing to steer or the port would not take the interrupt.
    ///
    /// The follow-up is NOT removed here. Nothing has been delivered yet, and a chip that vanished
    /// on the interrupt would be a Turn reported sent on the strength of having asked — the thing
    /// `stopped(via:)` states must never happen. It is marked instead, and the chip says so.
    ///
    /// The rest of the queue stays exactly where it is. That is the one place a steer parts company
    /// with Stop: an interrupt made in order to DELIVER is not the reader abandoning the run, so
    /// the follow-ups behind it still mean what they meant and still wait for the boundary — which
    /// is why the interrupt is claimed here, so the record's own marker does not drop them (#541,
    /// design decision 4).
    /// `package` for the reason `putNext(via:)` is: a specimen reaches the state by RUNNING the act
    /// rather than by setting the fields behind one.
    package mutating func beginSteer(
        _ id: QueuedTurn.ID,
        via interrupt: () throws -> Void,
    )
        -> QueuedTurn? {
        guard steeringTurn == nil, let turn = queued.first(where: { $0.id == id }) else {
            return nil
        }
        do {
            try interrupt()
        } catch {
            // Nothing was stopped, so nothing moves: the reason goes to the seam and the chip is
            // still simply queued — decision 8's rule read at this act.
            refused(by: ComposerSeamLine(error))
            return nil
        }
        refused(by: nil)
        claimSteerInterrupt()
        steeringTurn = id
        return turn
    }

    /// The steered follow-up reached the Session: it leaves the queue, exactly as it would have at
    /// the boundary.
    mutating func steerLanded(_ id: QueuedTurn.ID) {
        steeringTurn = nil
        // Before anything else moves: taking the follow-up out of the queue is itself a movement
        // the release watches, and the status it would be read against is still the one this
        // steer's own interrupt produced. The claim is the release's own — see
        // `ComposerDraft+PutTurn.swift`, where a follow-up put at the boundary makes the same one.
        claimPutTurn()
        // The chip's own `×` act: one follow-up leaves the queue by id, and a delivered steer
        // takes it out exactly as a cancel would have.
        cancel(id)
        refused(by: nil)
    }

    /// The interrupt landed and the words did not.
    ///
    /// The follow-up stays queued, in the place it was already in. What carries it next is the
    /// seam's Retry and not the ordinary release: a refusal is standing now, and the release
    /// declines while one does (`ComposerRelease.putsNext`) precisely so the same words are not put
    /// to the same port at every reading. The chip says which one was reached.
    mutating func steerRefused(_ id: QueuedTurn.ID, _ error: any Error) {
        steeringTurn = nil
        refused(by: ComposerSeamLine(error))
        refusedTurn = id
    }

    /// Which of its three words one waiting follow-up is wearing.
    ///
    /// Read here rather than assembled in the vessel, so the order is a claim a test can make: the
    /// steer in flight outranks a refusal, because it is the newer fact about that follow-up and
    /// the older one is the reason it is being steered at all.
    func standing(of id: QueuedTurn.ID) -> QueuedTurnStanding {
        if steeringTurn == id {
            return .steering
        }
        return refusedTurn == id ? .notSent : .queued
    }

    /// Say that a STEER's interrupt has landed and the record has yet to report it (#1238).
    ///
    /// Its own count and never `unansweredStops`, though both are an `ESC` this composer put on
    /// the wire. They agree about the boundary — either one answers it, so `mustDropQueue` reads
    /// both — and disagree about everything else. `unansweredStops` also arms the wait above, and
    /// a steer counted there would post "Stop did not take. The Session is still running." over a
    /// reader who pressed no Stop, about a Session running exactly what they just steered it onto.
    mutating func claimSteerInterrupt() {
        steerInterrupts += 1
    }
}
