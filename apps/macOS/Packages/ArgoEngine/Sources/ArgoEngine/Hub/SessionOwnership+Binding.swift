import Foundation

/// Where the spawn and the transcript meet: the spawn named the transcript, the file appears under
/// that name, so the row published at spawn stands down rather than doubling (#361).
@MainActor
extension SessionOwnership {
    /// Record which claim owns an observed Session, now that its transcript exists.
    ///
    /// Returns the claim this Session JOINED, so the caller can retire whatever it published under
    /// that claim's own id. `nil` otherwise — an unowned Session, or a re-observation of one
    /// already bound. It answers a second time for one claim where the file MOVED, and that answer
    /// is the same Session under a new key rather than a second Session.
    ///
    /// `uuid` is the transcript's own id, and it must EQUAL what the claim named. Nothing weaker is
    /// enough: a folder and a start time also fit an agent Argo never started (#742).
    @discardableResult
    func bind(sessionID: String, uuid: String?) -> ClaimID? {
        guard boundSessions[sessionID] == nil, let uuid,
              let id = claimNaming(uuid: uuid) ?? liveClaimWhoseTranscriptMoved(to: uuid)
        else { return nil }
        closeFormerPath(of: id)
        claims[id]?.sessionID = sessionID
        boundSessions[sessionID] = id
        // The first moment the durable record CAN be written: until now Argo owned an agent, not a
        // Session, and the ledger is keyed by the id a later launch will see (ADR-0026).
        recordOwnership(of: sessionID)
        return id
    }

    /// The claim whose named transcript is already bound under a DIFFERENT path: the CLI moves the
    /// file into the worktree's own record directory when a Session enters one, and a Session is
    /// keyed by that path (#770, #942).
    ///
    /// LIVE only, where `claimNaming` takes a claim whether or not its PTY has exited: re-keying a
    /// released claim would open a ledger window for a process that is already gone.
    private func liveClaimWhoseTranscriptMoved(to uuid: String) -> ClaimID? {
        issuedOrder.first { id in
            guard let claim = claims[id], claim.toMs == nil else { return false }
            return claim.namedUUID == uuid && claim.sessionID != nil
        }
    }

    /// Close the ledger window on the path this claim was reachable under before the move: Argo
    /// holds no Session under a path that can never be written to again.
    ///
    /// The KEY stays, and that is what stops a re-observation of the abandoned path from walking
    /// the claim back off the file it is steering and closing that file's window instead.
    private func closeFormerPath(of id: ClaimID) {
        guard let former = claims[id]?.sessionID else { return }
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
