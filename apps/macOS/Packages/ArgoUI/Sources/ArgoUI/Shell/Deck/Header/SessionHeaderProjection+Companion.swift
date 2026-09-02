import ArgoEngine

/// What the ⓘ panel says about the companion channel (#493).
extension SessionHeaderProjection {
    /// The channel's reading, and `nil` where there is nothing to report on — a negative claim on
    /// every external row trains the reader past the one row that means something.
    ///
    /// Two of the three carry their consequence: `Dropped` alone would say a channel went and not
    /// what went with it, which is what a reader needs to tell it from a Session that never had
    /// one.
    static func companion(for liveness: CompanionLiveness) -> String? {
        switch liveness {
        case .notApplicable:
            nil
        case .live:
            "Live"
        case .neverDialled:
            "Not dialled in — this Session has yet to report anything of its own"
        // What it already said it PRODUCED survives the close, so this does not claim otherwise.
        case .dropped:
            "Dropped — what this Session says about itself stops updating, "
                + "and its status falls back to a reading of the transcript"
        }
    }
}
