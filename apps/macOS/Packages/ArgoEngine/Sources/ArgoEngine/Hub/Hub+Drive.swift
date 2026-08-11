import Foundation

@MainActor
public extension Hub {
    /// How this Hub's Sessions are driven — the ONE way in, so there is no second `setMode` beside
    /// it to take by mistake (#633).
    ///
    /// A value over `ownership`, `terminals` and `permissions`, all of which are fixed for the
    /// Hub's life. A caller may therefore hold what this answers rather than re-read it, which
    /// `CockpitActions` does.
    ///
    /// One adapter, because `AgentCLI` has one case. When a second CLI can be spawned this becomes
    /// a choice made on the Session's own `cli`, and the wrong place to make it is the surface that
    /// raised the intent.
    var driver: some SessionDriver {
        RememberingDriver(
            base: ClaudeSessionDriver(
                ownership: ownership,
                terminals: terminals,
                permissions: permissions,
                attachments: AttachmentStore(root: Self.attachmentRoot),
                stance: { [weak self] sessionID in self?.stance(of: sessionID) ?? .unknown },
            ),
            remember: { [weak self] mode, sessionID in
                self?.rememberMode(mode, for: sessionID)
            },
        )
    }

    /// Where a rung that landed is filed (#545).
    ///
    /// Remembering is what makes a second change honest: `claude` writes its stance at Turn
    /// boundaries, so a set counted from the last record would count from before the previous set
    /// and walk the ring too far. It is also the only place Plan can survive, because the CLI
    /// reports Read Only's boundary for both.
    private func rememberMode(_ mode: SessionMode, for sessionID: String) {
        // Read after the keystrokes rather than before: the roster moves only on an observation,
        // and nothing observes inside a synchronous write.
        let observed = session(id: sessionID)?.observedMode
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.setMode(SessionModeSet(mode: mode, observedWhenSet: observed), for: claim)
    }

    /// Where one Session stands, off the roster. It is the same reading every surface draws, so the
    /// rung a change is counted from cannot disagree with the rung the footer states.
    private func stance(of sessionID: String) -> SessionStance {
        guard let session = session(id: sessionID) else { return .unknown }
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
