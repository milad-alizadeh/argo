import ArgoEngine

/// What the ⓘ panel says about the companion channel (#493) — the one place a reader can find out
/// whether the facts an agent reports about itself are still arriving.
///
/// A Session with no channel to report on says NOTHING here. A negative claim on every external
/// row would train the reader past the one row where it means something, and "no companion" is not
/// a fault of a Session Argo never spawned.
extension SessionHeaderProjection {
    /// The channel's reading, in the panel's own register, and `nil` where there is nothing to
    /// report on.
    ///
    /// Two of the three readings carry their consequence, because the word alone would mislead:
    /// `Dropped` says a channel went and not what went with it, and a reader who cannot see that
    /// the agent's own status stopped arriving has no way to tell a lost channel from a Session
    /// that never had one. `Live` needs no sentence — nothing is missing.
    static func companion(for liveness: CompanionLiveness) -> String? {
        switch liveness {
        case .notApplicable:
            nil
        case .live:
            "Live"
        case .neverDialled:
            "Not dialled in — this Session has yet to report anything of its own"
        // What is lost, in the order it is lost: the agent's own status and question stop being
        // read (`CompanionReport.channelClosed`), and Argo falls back to reading the transcript.
        // What it already said it produced is kept, so this does not claim otherwise.
        case .dropped:
            "Dropped — what this Session says about itself stops updating, "
                + "and its status falls back to a reading of the transcript"
        }
    }
}
