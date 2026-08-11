import Foundation

/// Where the spawn and the transcript meet: the spawn knew a folder and a moment, the record knows
/// the id the CLI picked, so the row published at spawn stands down rather than doubling (#361).
@MainActor
extension SessionOwnership {
    /// Record which claim owns an observed Session, now that it HAS an id.
    ///
    /// Returns the claim this Session JOINED, once and only on the observation that joined it, so
    /// the caller can retire whatever it published under that claim's own id. `nil` otherwise — an
    /// unowned Session, or a re-observation of one already bound.
    ///
    /// A Session keeps the first agent it was given, so a later sweep cannot tear the PTY out from
    /// under an open terminal.
    @discardableResult
    func bind(sessionID: String, cwd: String?, startedAtMs: Int?) -> ClaimID? {
        guard boundSessions[sessionID] == nil,
              let id = claimFor(cwd: cwd, startedAtMs: startedAtMs)
        else { return nil }
        claims[id]?.sessionID = sessionID
        boundSessions[sessionID] = id
        // The first moment the durable record CAN be written: until now Argo owned an agent, not a
        // Session, and the ledger is keyed by the id a later launch will see (ADR-0026).
        recordOwnership(of: sessionID)
        return id
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

    /// The claim a Session is bound to, live or not. Unlike `ownerOf`, what a claim SAID outlives
    /// its PTY, so an orphaned Session keeps the CONVENTION facts it reported while it ran.
    func boundClaim(ofSessionID sessionID: String) -> ClaimID? {
        boundSessions[sessionID]
    }
}
