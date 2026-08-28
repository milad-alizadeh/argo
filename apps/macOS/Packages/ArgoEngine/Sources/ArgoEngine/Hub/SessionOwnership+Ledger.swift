/// The half of ownership that outlives the process: what Argo wrote down about Sessions it held
/// the PTY of, so the next launch can tell `orphaned` from `external` (ADR-0026).
@MainActor
extension SessionOwnership {
    /// Argo holds this Session's PTY. Folded into whatever is on disk now rather than over it: two
    /// windows spawning at once must not lose each other's ownership.
    func recordOwnership(of sessionID: String) {
        let ticket = boundSessions[sessionID].flatMap { claims[$0]?.ticket }
        ledger = ledgerStore.update(folding: ledger) {
            // `open` first, and its answer kept: the number is written onto the window `open`
            // creates, and the file has to be written when EITHER of the two moved.
            let opened = $0.open(sessionID: sessionID, atMs: now(), owner: owner)
            guard let ticket else { return opened }
            return $0.note(ticket: ticket, sessionID: sessionID) || opened
        }
    }

    /// The Ticket a spawn was told this claim is for (#894). On the claim first, because a fresh
    /// CLI has no Session id yet — a claim that already has one carries the number to the file now.
    func record(ticket: Int, ofClaim id: ClaimID) {
        claims[id]?.ticket = ticket
        guard let sessionID = claims[id]?.sessionID else { return }
        recordOwnership(of: sessionID)
    }

    /// What a previous Argo was told this Session was started ON. DIRECT and durable, which is what
    /// keeps a relaunch from degrading a spawn-seeded link to the branch guess (#894).
    func spawnTicket(ofSessionID sessionID: String) -> Int? {
        ledger.ticket(sessionID: sessionID)
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
