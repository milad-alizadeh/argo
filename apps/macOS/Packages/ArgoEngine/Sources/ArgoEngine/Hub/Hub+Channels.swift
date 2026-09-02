import Foundation

/// The channels an agent Argo spawned talks back over. Both write into the claim ledger, which is
/// where the prompts, the standing allows and the refused calls are read back from.
@MainActor
public extension Hub {
    /// The companion row's fact (#570); `nil` where no channel was opened, rendered `unknown`.
    var companionStanding: CompanionStanding? {
        companion?.standing
    }
}

extension Hub {
    /// Opened at construction, not lazily: a channel that came into being on the first spawn would
    /// be a second thing that could fail at the moment an agent starts — which is the one moment
    /// there is nothing useful to say about it.
    func openCompanionChannel() {
        companion = CompanionChannel(
            scope: companionScope,
            onLiveness: { [weak self] claim, liveness in
                self?.claims.publish(companionLiveness: liveness, for: claim)
            },
            onFact: { [weak self] claim, fact in
                self?.claims.record(fact, for: claim)
            },
        )
        permissions = PermissionChannel(
            scope: companionScope,
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
