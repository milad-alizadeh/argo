/// The half of ownership that outlives the process: what Argo wrote down about Sessions it held
/// the PTY of, so the next launch can tell `orphaned` from `external` (ADR-0026).
@MainActor
extension SessionOwnership {
    /// Argo holds this Session's PTY. Folded into whatever is on disk now rather than over it: two
    /// windows spawning at once must not lose each other's ownership.
    func recordOwnership(of sessionID: String) {
        ledger = ledgerStore.update(folding: ledger) {
            $0.open(sessionID: sessionID, atMs: now(), owner: owner)
        }
    }

    /// And no longer does. Written at release rather than left open, so a window closed cleanly
    /// says so — an open window whose owner is gone is an Argo that was killed.
    func recordRelease(of sessionID: String) {
        ledger = ledgerStore.update(folding: ledger) {
            $0.close(sessionID: sessionID, atMs: now())
        }
    }

    /// Whether an Argo — this one or one that is gone — has ever held this Session's PTY. The whole
    /// of what grading asks of the file.
    func hasEverOwned(sessionID: String) -> Bool {
        ledger.hasOwned(sessionID: sessionID)
    }

    /// Whether another live cockpit window is steering this Session. Read from disk rather than
    /// from the copy held here: that window opened its claim after this one launched.
    func isHeldElsewhere(sessionID: String) -> Bool {
        ledgerStore.load().isHeld(sessionID: sessionID, byAnyoneBut: owner)
    }
}
