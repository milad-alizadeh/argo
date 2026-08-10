import Foundation

/// Where the spawn and the transcript meet.
///
/// The spawn knew a folder and a moment; the record knows the id the CLI picked. Binding is the
/// one act that puts those together, and it is what lets the row published at spawn stand down
/// instead of standing beside the Session it turned out to be (#361).
@MainActor
extension SessionOwnership {
    /// Record which claim owns an observed Session, now that it HAS an id.
    ///
    /// Returns the claim this Session JOINED, once and only on the observation that joined it, so
    /// the caller can retire whatever it published under that claim's own id. `nil` otherwise — an
    /// unowned Session, or a re-observation of one already bound.
    ///
    /// A Session keeps the first agent it was given, so a later sweep cannot tear the PTY out from
    /// under an open terminal and a claim is never reported as joined twice.
    @discardableResult
    func bind(sessionID: String, cwd: String?, startedAtMs: Int?) -> ClaimID? {
        guard boundSessions[sessionID] == nil,
              let id = claimFor(cwd: cwd, startedAtMs: startedAtMs)
        else { return nil }
        claims[id]?.sessionID = sessionID
        boundSessions[sessionID] = id
        return id
    }

    /// The live claim whose PTY this Session steers; `nil` when there is none.
    ///
    /// A released claim has no PTY left, so an orphaned Session steers nothing — the same answer
    /// its provenance gives, from the same fact.
    func ownerOf(sessionID: String) -> ClaimID? {
        guard let id = boundSessions[sessionID], claims[id]?.toMs == nil else { return nil }
        return id
    }

    /// The row a claim's agent is currently reachable under: the id its CLI picked once a record
    /// named one, and the claim's own id until then.
    ///
    /// What a handoff has to be read through. The fresh Session is published under a claim id and
    /// re-keyed to the CLI's id the moment its transcript appears (#361), so an edge that stored
    /// the id it was given would point at a row that stood down minutes ago — the link would go
    /// nowhere exactly when the work it names started being done.
    ///
    /// An id no claim was ever issued for comes back unchanged. Nothing here invents a rebind: a
    /// host that answers spawns with something other than a claim is one whose ids are already the
    /// rows they name.
    func rowID(ofClaim value: String) -> String {
        claims[ClaimID(value: value)]?.sessionID ?? value
    }

    /// The claim a Session is bound to, live or not.
    ///
    /// Distinct from `ownerOf`, which answers "what can this Session steer": what a claim SAID
    /// outlives its PTY, so an orphaned Session keeps the CONVENTION facts it reported while it ran
    /// rather than having them vanish with the process.
    func boundClaim(ofSessionID sessionID: String) -> ClaimID? {
        boundSessions[sessionID]
    }
}
