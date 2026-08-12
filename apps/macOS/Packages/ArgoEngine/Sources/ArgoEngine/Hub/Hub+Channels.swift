import Foundation

/// The channels an agent Argo spawned talks back over. Both write into the claim ledger, which is
/// where the prompts, the standing allows and the refused calls are read back from.
extension Hub {
    /// Opened at construction, not lazily: a channel that came into being on the first spawn would
    /// be a second thing that could fail at the moment an agent starts — which is the one moment
    /// there is nothing useful to say about it.
    func openCompanionChannel() {
        let root = spawnServices.companionRoot
        companion = CompanionChannel(root: root) { [weak self] claim, fact in
            self?.claims.record(fact, for: claim)
        }
        permissions = PermissionChannel(
            root: root,
            patience: spawnServices.permissionPatience,
            ledger: claims,
            rung: { [weak self] claim in self?.rung(ofClaim: claim) },
        )
    }

    /// The rung one claim's Session stands on, off the roster the surfaces read (#663). Through
    /// `rowID`, because the row is re-keyed to the id its CLI picks the moment a record appears.
    private func rung(ofClaim claim: SessionOwnership.ClaimID) -> SessionMode? {
        session(id: ownership.rowID(ofClaim: claim.value))?.mode.rung
    }

    /// What is known about one claim, in one reading — the accessor the suites assert through, in
    /// place of the five dictionaries they reached into before #634.
    func facts(forClaim claim: SessionOwnership.ClaimID) -> ClaimFacts {
        claims.facts(for: claim)
    }
}
