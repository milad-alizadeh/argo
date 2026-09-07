import ArgoEngine

/// What the roster says about rows that have stopped standing under a claim id — in the package
/// rather than on the coordinator for the reason ADR-0022 gives: a derivation in the app target is
/// one no test can reach.
public extension CockpitPresentation {
    /// Every row now standing under the id its CLI picked, keyed by the CLAIM id it stood under
    /// before its transcript existed (#361). Where an annotation filed in that window has to be
    /// moved to (#1563), which is `SessionAnnotations.rekeying`.
    ///
    /// Claim ids alone, though `absorbedIDs` also carries what a continuation folded in: those are
    /// other chains' own keys, and a decision moved off one of them is a decision moved off
    /// somebody else's Session.
    var provisionalRowKeys: [String: String] {
        sessions.reduce(into: [String: String]()) { keys, session in
            for absorbed in session.absorbedIDs where SessionOwnership.isClaimID(absorbed) {
                keys[absorbed] = session.id
            }
        }
    }
}
