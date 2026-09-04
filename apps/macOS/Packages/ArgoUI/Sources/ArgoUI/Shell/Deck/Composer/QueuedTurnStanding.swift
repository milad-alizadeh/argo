import ArgoDesign

/// Where one waiting follow-up has got to, as the word on its chip.
///
/// Three states and one word each, because the chip is a row of a list the eye scans: what a
/// reader needs from it is which of these three this one is, and nothing longer would be read at
/// all. The sentence BEHIND a state — the port's reason, verbatim — is the seam's, one line above.
enum QueuedTurnStanding: Equatable {
    /// Waiting for the Turn to end, which is what every follow-up does until something moves it.
    case queued
    /// Being steered into the running Turn right now: the interrupt has gone and the words have
    /// not (`ComposerDraft.beginSteer(_:via:)`).
    case steering
    /// A release reached it and the port refused. The words are still here and Retry still puts
    /// them — see `ComposerDraft.refusedTurn`.
    case notSent

    /// Said in the machine face the rest of the vessel's meta is set in. Present tense for the act
    /// in flight and past for the two at rest, which is the difference a reader is reading for.
    var label: String {
        switch self {
        case .queued: "QUEUED"
        case .steering: "SENDING"
        case .notSent: "NOT SENT"
        }
    }

    /// Whether this follow-up is still the reader's to act on — whether the chip offers ANY
    /// control, which is what its two mean together rather than either one by itself.
    ///
    /// A steer in flight offers none: the interrupt has already landed, so there is no longer a
    /// Turn to keep these words back from, and a cancel that raced the paste would take back a
    /// follow-up the agent may already have.
    var isActionable: Bool {
        self != .steering
    }

    /// The ink for the word, as a role read off the contract by the chip that draws it — `nil`
    /// where the accent is right, which is the ordinary case.
    ///
    /// `notSent` takes the seam's own failure ink, so the chip and the sentence above it read as
    /// ONE fact. `steering` takes the quiet ramp rather than a third hue: it is a moment passing,
    /// not an outcome, and hue is rationed.
    var ink: Ink? {
        switch self {
        case .queued: nil
        case .steering: .quiet
        case .notSent: .failure
        }
    }

    /// Which named ink, without naming a colour here: `ArgoColor` comes off the environment, and
    /// only a view has one.
    enum Ink {
        case quiet
        case failure
    }
}
