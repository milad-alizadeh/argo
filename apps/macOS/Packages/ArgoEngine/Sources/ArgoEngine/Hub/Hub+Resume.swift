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
        guard let session = session(id: sessionID)
        else { throw SessionResumeError.unknownSession }
        guard session.provenance == .orphaned else { throw SessionResumeError.notArgosToResume }
        guard let resumeID = session.resumeID, let cwd = session.cwd
        else { throw SessionResumeError.noChainToResume }
        try await spawnSession(cli: cli, seed: SessionSeed(
            cwd: cwd,
            mode: rung(resuming: session),
            resuming: SessionResumeTarget(chainID: resumeID, sessionID: sessionID),
        ))
    }

    /// Which rung a resumed Session comes back on — stated here rather than left to a fall-through,
    /// because three facts can answer and they disagree (#966).
    ///
    /// 1. The rung the RECORD last stated, where it states one. The user may have moved this
    ///    Session down the ladder mid-build, and a resume that overrode that would drag them back
    ///    up. Argo is matching what it read rather than moving the Session.
    /// 2. Otherwise the rung this Session was STARTED on, where a Start named one — a Session
    ///    started from a Ticket (#941). It is the same piece of work either side of the orphaning,
    ///    so the friction #941 removed must not come back with the next process.
    /// 3. Otherwise nothing, and the spawn takes the rung last picked (#629) — the only defensible
    ///    answer for a Session with no Start of its own to honour. A resume never WRITES that
    ///    store: what the next New Session opens on is the user's pick, not a resume's arithmetic.
    ///
    /// Every answer is a rung Argo then starts the CLI on, so the row states a rung Argo owns —
    /// DIRECT either way, and no guess is dressed up as one.
    private func rung(resuming session: HubSession) -> SessionMode? {
        session.mode.rung ?? ownership.startingRung(ofSessionID: session.id)
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
