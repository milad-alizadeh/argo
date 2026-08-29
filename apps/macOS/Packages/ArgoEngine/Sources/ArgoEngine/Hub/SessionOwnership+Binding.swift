import Foundation

/// Where the spawn and the transcript meet: the spawn named the transcript, the file appears under
/// that name, so the row published at spawn stands down rather than doubling (#361).
@MainActor
extension SessionOwnership {
    /// Record which claim owns an observed Session, now that its transcript exists.
    ///
    /// Returns the claim this Session JOINED, so the caller can retire whatever it published under
    /// that claim's own id and re-point what it filed against the last one. `nil` otherwise — an
    /// unowned Session, or a re-observation of one already bound.
    ///
    /// `uuid` is the transcript's own id, and it must EQUAL what the claim named. Nothing weaker is
    /// enough: a folder and a start time also fit an agent Argo never started (#742).
    ///
    /// It answers TWICE for one claim where the file moved, because the second answer is the same
    /// Session under a new key rather than a second Session.
    @discardableResult
    func bind(sessionID: String, uuid: String?) -> ClaimID? {
        guard boundSessions[sessionID] == nil, let uuid,
              let id = claimNaming(uuid: uuid) ?? claimWhoseTranscriptMoved(to: uuid)
        else { return nil }
        forgetFormerPath(of: id)
        claims[id]?.sessionID = sessionID
        boundSessions[sessionID] = id
        // The first moment the durable record CAN be written: until now Argo owned an agent, not a
        // Session, and the ledger is keyed by the id a later launch will see (ADR-0026).
        recordOwnership(of: sessionID)
        return id
    }

    /// The live claim whose named transcript is already bound under a DIFFERENT path: the CLI MOVES
    /// the file into the worktree's own record directory when the Session enters one, and the
    /// roster keys a Session by that path (#770, #942).
    ///
    /// One uuid under two paths is that move and nothing else. A resume writes a new uuid, and a
    /// transcript no claim NAMED answers this no more than it answers `claimNaming` (#742) — so
    /// following the file cannot widen ownership to an agent Argo did not start.
    private func claimWhoseTranscriptMoved(to uuid: String) -> ClaimID? {
        issuedOrder.first { id in
            guard let claim = claims[id], claim.toMs == nil else { return false }
            return claim.namedUUID == uuid && claim.sessionID != nil
        }
    }

    /// Let go of the path this claim was reachable under before the move, so one claim keys one
    /// Session. Its ledger window is CLOSED rather than left open: an open window says Argo is
    /// steering that Session now, and nothing steers a path that can never be written again.
    private func forgetFormerPath(of id: ClaimID) {
        guard let former = claims[id]?.sessionID else { return }
        boundSessions.removeValue(forKey: former)
        recordRelease(of: former)
    }

    /// The live claim whose PTY this Session steers; `nil` when there is none — a released claim
    /// has no PTY left, so an orphaned Session steers nothing.
    func ownerOf(sessionID: String) -> ClaimID? {
        guard let id = boundSessions[sessionID], claims[id]?.toMs == nil else { return nil }
        return id
    }

    /// The row a claim's agent is currently reachable under: the id its CLI picked once a record
    /// named one, and the claim's own id until then. A fresh Session is re-keyed the moment its
    /// transcript appears (#361), so a stored id would point at a row that stood down. An id no
    /// claim was issued for comes back unchanged.
    func rowID(ofClaim value: String) -> String {
        claims[ClaimID(value: value)]?.sessionID ?? value
    }

    /// The claim a Session is bound to, live or not. Unlike `ownerOf`, what a claim PRODUCED
    /// outlives its PTY, so an orphaned Session keeps the Outcomes it reported while it ran — but
    /// not the status it reported, which went with the channel it stood on (#799).
    func boundClaim(ofSessionID sessionID: String) -> ClaimID? {
        boundSessions[sessionID]
    }
}
