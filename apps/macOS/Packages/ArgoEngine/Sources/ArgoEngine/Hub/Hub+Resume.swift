/// Starting the next link of a chain Argo can no longer steer (#10, ADR-0026).
@MainActor
public extension Hub {
    /// Continue this Session in a new process on the same chain, and own the PTY it gets.
    ///
    /// Lazy and per-Session: nothing resumes at launch, and a Session already being steered — by
    /// this window or another one — resumes nothing. Two agents on one chain is the failure this
    /// guards against, and the second one would be invisible: it writes to the same chain.
    ///
    /// Re-entrant by construction rather than by a flag. The claim opens before the first `await`,
    /// so a click answered while `claude` is still starting finds the Session owned and stops.
    func resumeSession(sessionID: String, cli: AgentCLI = .claude) async throws {
        guard ownership.ownerOf(sessionID: sessionID) == nil else { return }
        guard !ownership.isHeldElsewhere(sessionID: sessionID)
        else { throw SessionResumeError.heldByAnotherWindow }
        guard let session = sessions.first(where: { $0.id == sessionID })
        else { throw SessionResumeError.unknownSession }
        guard session.provenance == .orphaned else { throw SessionResumeError.notArgosToResume }
        guard let resumeID = session.resumeID, let cwd = session.cwd
        else { throw SessionResumeError.noChainToResume }
        try await spawnSession(cli: cli, seed: SessionSeed(
            cwd: cwd,
            // The rung the record last stated, and the rung a New Session takes where it stated
            // none (ADR-0025, #629). Nothing is recorded as a set: Argo is matching what it read
            // rather than moving the Session.
            mode: session.mode.rung,
            resuming: SessionResumeTarget(chainID: resumeID, sessionID: sessionID),
        ))
    }
}

/// Why a resume did not happen — as opposed to `AgentSpawnError`, which is a process that would not
/// start.
public enum SessionResumeError: Error, Equatable {
    /// Nothing on the roster answers to that id.
    case unknownSession
    /// Argo never spawned this Session, and taking over one it only observed is out of scope.
    case notArgosToResume
    /// No record on disk to continue from — a spawn whose CLI wrote nothing before it died.
    case noChainToResume
    /// Another live Argo holds this Session's PTY. Resuming would put two agents on one chain, and
    /// the ledger's open window plus a living owner is how that is known across windows.
    case heldByAnotherWindow

    public var detail: String {
        switch self {
        case .unknownSession:
            "That session is no longer on the roster"
        case .notArgosToResume:
            "Argo did not start this session, so it cannot continue it"
        case .noChainToResume:
            "This session wrote no transcript, so there is nothing to continue"
        case .heldByAnotherWindow:
            "Another Argo window is already running this session"
        }
    }
}
