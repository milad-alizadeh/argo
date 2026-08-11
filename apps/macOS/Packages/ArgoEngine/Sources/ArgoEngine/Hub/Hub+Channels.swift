import Foundation

/// The channels an agent Argo spawned talks back over, and what they publish onto the Hub's own
/// state: the prompts a claim is blocked on, the tools it has stopped asking about, and the calls
/// its gate refused when nobody answered them.
extension Hub {
    /// Opened at construction, not lazily: they close over `self`, and a channel that came into
    /// being on the first spawn would be a second thing that could fail at the moment an agent
    /// starts — which is the one moment there is nothing useful to say about it.
    func openCompanionChannel() {
        let root = spawnServices.companionRoot
        companion = CompanionChannel(root: root) { [weak self] claim, fact in
            self?.record(fact, for: claim)
        }
        permissions = PermissionChannel(
            root: root,
            patience: spawnServices.permissionPatience,
            onChange: { [weak self] claim, waiting in self?.publish(waiting, for: claim) },
            onStanding: { [weak self] claim, standing in
                self?.publish(standing: standing, for: claim)
            },
            onExpired: { [weak self] claim, expired in
                self?.publish(expired: expired, for: claim)
            },
        )
    }

    /// Absent rather than empty, on both of these: a claim with nothing waiting and a claim with
    /// nothing granted are the state every Session is in, and an empty array left in the table
    /// would keep a claim alive in it long after the PTY behind it went.
    func publish(_ waiting: [PermissionRequest], for claim: SessionOwnership.ClaimID) {
        if waiting.isEmpty {
            pendingPermissions.removeValue(forKey: claim)
        } else {
            pendingPermissions[claim] = waiting
        }
    }

    func publish(standing granted: [StandingAllow], for claim: SessionOwnership.ClaimID) {
        if granted.isEmpty {
            standingAllows.removeValue(forKey: claim)
        } else {
            standingAllows[claim] = granted
        }
    }

    func publish(expired: [PermissionExpiry], for claim: SessionOwnership.ClaimID) {
        if expired.isEmpty {
            expiredPermissions.removeValue(forKey: claim)
        } else {
            expiredPermissions[claim] = expired
        }
    }
}
