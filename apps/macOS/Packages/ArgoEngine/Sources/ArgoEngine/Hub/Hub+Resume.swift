/// Starting the next link of a chain Argo can no longer steer (#10, ADR-0026).
///
/// The PTY died with the Argo that owned it and cannot be re-adopted — that half of `CONTEXT.md` L2
/// still holds. What does not is the conclusion drawn from it: a Session is a logical resume-chain,
/// and `claude --resume` continues one in a fresh process. The channel is re-OPENED, not
/// re-adopted.
@MainActor
public extension Hub {
    /// Continue this Session in a new process on the same chain, and own the PTY it gets.
    ///
    /// Lazy and per-Session: nothing resumes at launch, and a Session whose PTY is already live
    /// resumes nothing. Selection has always been free, and this is the one case that spends.
    func resumeSession(sessionID: String, cli: AgentCLI = .claude) async throws {
        guard ownership.ownerOf(sessionID: sessionID) == nil else { return }
        guard let session = sessions.first(where: { $0.id == sessionID })
        else { throw SessionResumeError.unknownSession }
        guard session.provenance == .orphaned else { throw SessionResumeError.notArgosToResume }
        guard let resumeID = session.resumeID, let cwd = session.cwd
        else { throw SessionResumeError.noChainToResume }
        // A `claude` takes seconds to start, and selection can fire again inside them. Without this
        // the second click is a second agent on one chain.
        guard resuming.insert(sessionID).inserted else { return }
        defer { resuming.remove(sessionID) }
        try await spawnSession(cli: cli, seed: SessionSeed(
            cwd: cwd,
            // The rung it was already observed standing on, so the resume changes nothing about the
            // stance. Nothing is recorded as a set: Argo is matching the record, not moving it.
            mode: session.mode.rung ?? .code,
            resuming: resumeID,
        ))
    }
}

/// Why a resume did not happen. Separate from `AgentSpawnError`, which is about a process that
/// could not start: every case here is about a Session that was never Argo's to continue, and none
/// of them is answered by trying again.
public enum SessionResumeError: Error, Equatable {
    /// Nothing on the roster answers to that id.
    case unknownSession
    /// Argo never spawned this Session. An `external` Session belongs to whoever started it, and
    /// taking it over is a decision this ticket did not make.
    case notArgosToResume
    /// No record on disk to continue from — a spawn whose CLI wrote nothing before it died.
    case noChainToResume

    public var detail: String {
        switch self {
        case .unknownSession:
            "That session is no longer on the roster"
        case .notArgosToResume:
            "Argo did not start this session, so it cannot continue it"
        case .noChainToResume:
            "This session wrote no transcript, so there is nothing to continue"
        }
    }
}
