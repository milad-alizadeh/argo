/// Ending one Session's agent, whether this Hub still owns it or a previous Argo did (#1290,
/// #1609).
@MainActor
public extension Hub {
    /// ONE Session Argo started, ended: a managed Session through its PTY, or an orphaned Claude
    /// Session through the unique identifier Argo put on its process argv.
    ///
    /// An external Session stays out of reach: Argo never put an identifier on that process. Codex
    /// stays out too because its Session id rides inside the protocol, not on argv. An orphaned
    /// Claude Session carries `--session-id` or `--resume`, so the process table can join it
    /// without the many-to-one cwd guess. Any ambiguous argv join ends nothing.
    ///
    /// `ownerOf` answers both cases in one read — an unowned Session was never bound, and an
    /// orphaned one's claim has stood down — so nothing switches on `SessionProvenance` a second
    /// way.
    func endSession(id sessionID: String) async -> SessionEndResult {
        if let claim = ownership.ownerOf(sessionID: sessionID) {
            endOwnedClaim(claim)
            return .ended
        }
        guard let session = session(id: sessionID), session.provenance == .orphaned,
              session.cli == .claude
        else { return .notApplicable }
        return await OrphanedSessionProcess(services: spawnServices.orphanedSessionProcess)
            .endClaudeSession(identifiedBy: session.chainTranscriptIDs)
    }

    /// What the archive gesture asks of the Hub: archiving a Session Argo owns ends it, and putting
    /// one back starts nothing.
    func endSession(archiving isArchived: Bool, id sessionID: String) async -> SessionEndResult {
        guard isArchived else { return .notApplicable }
        return await endSession(id: sessionID)
    }
}
