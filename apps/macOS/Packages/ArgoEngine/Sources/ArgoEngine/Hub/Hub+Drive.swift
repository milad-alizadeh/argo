import Foundation

@MainActor
public extension Hub {
    /// How this Hub's Sessions are driven.
    ///
    /// Built per read rather than stored: the adapter is a value over `ownership` and `terminals`,
    /// so there is nothing here to hold — and a stored driver would be a second reference to the
    /// two tables the spawn already keys everything by.
    ///
    /// One adapter, because `AgentCLI` has one case. When a second CLI can be spawned this becomes
    /// a choice made on the Session's own `cli`, and the wrong place to make it is the surface that
    /// raised the intent.
    var driver: some SessionDriver {
        ClaudeSessionDriver(
            ownership: ownership,
            terminals: terminals,
            permissions: permissions,
            attachments: AttachmentStore(root: Self.attachmentRoot),
            stance: { [weak self] sessionID in self?.stance(of: sessionID) ?? .unknown },
        )
    }

    /// One rung asked for, and remembered where it lands (#545).
    ///
    /// Remembering is what makes a second change honest: `claude` writes its stance at Turn
    /// boundaries, so a set counted from the last record would count from before the previous set
    /// and walk the ring too far. It is also the only place Plan can survive, because the CLI
    /// reports Read Only's boundary for both.
    func setMode(_ mode: SessionMode, for sessionID: String) throws {
        let observed = sessions.first { $0.id == sessionID }?.observedMode
        try driver.setMode(mode, for: sessionID)
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        setModes[claim] = SessionModeSet(mode: mode, observedWhenSet: observed)
    }

    /// Where one Session stands, off the roster. It is the same reading every surface draws, so the
    /// rung a change is counted from cannot disagree with the rung the footer states.
    private func stance(of sessionID: String) -> SessionStance {
        guard let session = sessions.first(where: { $0.id == sessionID }) else { return .unknown }
        return SessionStance(mode: session.mode, isRunning: session.status == .running)
    }

    /// Where a pasted attachment's bytes land: Argo's own per-machine data, beside `handoffs/`.
    /// Never the Project — see `AttachmentStore` for why the Workspace was the wrong folder.
    static var attachmentRoot: URL {
        handoffRoot
            .deletingLastPathComponent()
            .appending(path: "attachments", directoryHint: .isDirectory)
    }
}
