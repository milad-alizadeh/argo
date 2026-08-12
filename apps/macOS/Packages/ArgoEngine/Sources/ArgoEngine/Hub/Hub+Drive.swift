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
    /// Two adapters, one per `AgentCLI`, with the choice between them made on the Session rather
    /// than at the surface that raised the intent (`SessionAdapters`).
    var driver: some SessionDriver {
        RememberingDriver(
            base: SessionAdapters(
                claude: ClaudeSessionDriver(
                    ownership: ownership,
                    terminals: terminals,
                    permissions: permissions,
                    attachments: AttachmentStore(root: Self.attachmentRoot),
                    delivery: delivery,
                    stance: { [weak self] sessionID in self?.stance(of: sessionID) ?? .unknown },
                ),
                codex: CodexSessionDriver(
                    ownership: ownership,
                    threads: codex,
                    attachments: AttachmentStore(root: Self.attachmentRoot),
                ),
                isCodex: { [weak self] sessionID in self?.isCodex(sessionID) ?? false },
            ),
            records: { [weak self] sessionID in self?.observedModeCount(of: sessionID) ?? 0 },
            remember: { [weak self] set, sessionID in
                self?.rememberMode(set, for: sessionID)
            },
        )
    }

    /// Whether this Session is driven over `codex app-server` — true exactly while Argo holds a
    /// live thread for it, which is the same fact `ownerOf` grades steerability on.
    internal func isCodex(_ sessionID: String) -> Bool {
        ownership.ownerOf(sessionID: sessionID).flatMap(codex.thread(for:)) != nil
    }

    /// What starts one CLI's surface: a PTY for the interactive `claude`, pipes for `codex
    /// app-server`.
    ///
    /// The PTY host is what says this window may start agents AT ALL — a Hub built with none is
    /// the render harness and every suite about observation, and neither may launch anything. So a
    /// Codex spawn is refused for want of a host it will not itself use.
    internal func host(for cli: AgentCLI) throws -> AgentProcessHost {
        guard let pty = spawnServices.host else {
            throw AgentSpawnError.hostRefused(detail: "This window cannot start agents")
        }
        switch cli {
        case .claude: return pty
        case .codex: return codexHost
        }
    }

    /// Where a rung that landed is filed (#545), and where the next New Session reads its own
    /// opening rung from (#629).
    ///
    /// Remembering is what makes a second change honest: `claude` writes its stance at Turn
    /// boundaries, so a set counted from the last record would count from before the previous set
    /// and walk the ring too far. It is also the only place Plan can survive, because the CLI
    /// reports Read Only's boundary for both.
    ///
    /// Reached only after the port took the rung, so a change the driver refused is never the one
    /// the next New Session opens on.
    ///
    /// The stance record COUNT and not its value: a record repeating the old rung is the CLI
    /// disagreeing, and one compared by value cannot tell that from a record yet to catch up.
    private func rememberMode(_ set: SessionModeSet, for sessionID: String) {
        modeStore.remember(set.mode)
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.setMode(set, for: claim)
    }

    /// The watch behind `delivery`, built here beside the driver it reports for.
    ///
    /// All three answers are read off this Hub at the moment they are asked, never held: a Turn is
    /// watched for seconds, and a copy of the record count taken when the watch began would be
    /// exactly the reading that cannot see the Turn arrive.
    ///
    /// Only the Claude adapter ever starts a watch, because only a keystroke can be eaten by a
    /// popup. `isCodex` is asked anyway: a claim's bytes go to whichever table owns them, so a
    /// Return typed at a Codex claim would land in the middle of its JSON-RPC and corrupt a
    /// protocol stream rather than fail.
    internal func makeDelivery() -> TurnDelivery {
        TurnDelivery(TurnDelivery.Watch(
            records: { [weak self] sessionID in self?.session(id: sessionID)?.events.count ?? 0 },
            retype: { [weak self] sessionID in
                guard let self, !isCodex(sessionID),
                      let claim = ownership.ownerOf(sessionID: sessionID)
                else { return false }
                return terminals.write(ClaudeTurn.submit, to: claim)
            },
            lost: { [weak self] text, sessionID in self?.rememberLostTurn(text, for: sessionID) },
        ))
    }

    /// File a Turn the CLI never heard (#682), against the CLAIM like every other drive fact: a
    /// fresh Session is re-keyed to its own id the moment its record lands, and news filed under
    /// the id it had before would be lost at the re-key.
    ///
    /// A Session with no claim is one Argo cannot type at, so there was no Turn of ours to lose.
    internal func rememberLostTurn(_ text: String?, for sessionID: String) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.setLostTurn(text, for: claim)
    }

    /// The composer has the words back, so the news is spent. Taken back rather than left standing:
    /// a Turn reported lost twice is one the reader would put back twice.
    func clearLostTurn(for sessionID: String) {
        rememberLostTurn(nil, for: sessionID)
    }

    /// How many stance records a Session has written, read before a walk begins — see
    /// `SessionModeSet` for why the count and not the value.
    internal func observedModeCount(of sessionID: String) -> Int {
        session(id: sessionID)?.observedModeCount ?? 0
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
