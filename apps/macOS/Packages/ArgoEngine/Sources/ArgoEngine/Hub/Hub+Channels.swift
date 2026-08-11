import Foundation

/// What the permission gate publishes onto the Hub's own state — the prompts a claim is blocked on,
/// and the tools it has stopped asking about.
extension Hub {
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
}
