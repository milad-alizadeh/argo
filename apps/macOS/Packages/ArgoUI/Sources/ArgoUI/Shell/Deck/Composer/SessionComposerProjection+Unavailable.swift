import ArgoDesign

/// Why a Session has no composer, and what the line in its place says (#546, design decision 7).
///
/// The words live on the reason rather than in the view, for `SessionMode+Rung`'s reason: which
/// sentence a case carries is a fact about the case.
extension SessionComposerProjection {
    enum Unavailable: CaseIterable, Equatable {
        /// Never Argo's. Read-only from the first observation, and staying that way.
        case external
        /// Was Argo's: the PTY died and ownership cannot be re-adopted (`CONTEXT.md` L2).
        case orphaned
        /// Still Argo's, and over — an agent that reported `ended` while Argo held its PTY.
        case ended

        /// The bold half of the line, which is the reading itself.
        ///
        /// The one home for these words: the HEADER names the same two postures and reads them
        /// from here (`SessionHeaderProjection.mark(for:)`), so a copy edit cannot leave the band
        /// and the deck's foot disagreeing about what a Session is. This way round because this
        /// enum is TOTAL — `Access` has a fourth state, `managed`, with nothing to say of itself.
        var word: String {
            switch self {
            case .external: "Read-only"
            case .orphaned: "Orphaned"
            case .ended: "Ended"
            }
        }

        /// The sentence after it, addressed to a reader looking for the field. Its own words rather
        /// than the header's shorter ones: the band names a posture, this answers a question.
        ///
        /// The second clause of `external` is the one that has to be there. Argo holds no gate on a
        /// Session it did not spawn, so a reader told only *read-only* reads the silence where the
        /// Permissions would be as consent.
        var detail: String {
            switch self {
            case .external:
                "Argo did not spawn this Session, so there is nothing to steer. "
                    + "Permission here is unobservable, not granted."
            case .orphaned:
                "the steering channel died with the process that owned it. "
                    + "Argo can still read this Session, but cannot type into it."
            case .ended:
                "this Session is over, so there is nothing left to send to."
            }
        }

        /// One mark each, and they differ because that is what tells the three apart at a glance.
        /// `ended` takes the quiet `about` rather than a triangle: nothing went wrong here.
        var mark: String {
            switch self {
            case .external: ArgoSymbol.readOnlySession
            case .orphaned: ArgoSymbol.orphanedSession
            case .ended: ArgoSymbol.about
            }
        }

        /// Whether the line offers a fresh Session in the same folder — the one act that is
        /// actually available. `external` gets none: Argo never owned it, so starting something
        /// beside it is a guess about what the reader wanted rather than the way on.
        ///
        /// Exhaustive rather than `!= .external`, so a fourth reason cannot inherit an offer.
        var offersFreshSession: Bool {
            switch self {
            case .orphaned, .ended: true
            case .external: false
            }
        }

        /// What a screen reader hears, since the mark carries no words and the two halves of the
        /// line are one sentence.
        var announcement: String {
            "\(word) — \(detail)"
        }
    }

    /// Why the selected Session has no composer, or `nil` when it has one. `nil` for no Session at
    /// all, which is the empty deck rather than a degraded one.
    ///
    /// Access outranks status: what Argo may DO with a Session does not depend on what its
    /// transcript last said.
    static func unavailable(for session: CockpitPresentation.Session?) -> Unavailable? {
        guard let session else { return nil }
        switch session.access {
        case .external: return .external
        case .orphaned: return .orphaned
        case .managed: return session.status == .ended ? .ended : nil
        }
    }
}
