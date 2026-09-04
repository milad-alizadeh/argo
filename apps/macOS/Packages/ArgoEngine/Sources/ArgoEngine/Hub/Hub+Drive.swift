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
            base: adapters,
            records: { [weak self] sessionID in self?.observedModeCount(of: sessionID) ?? 0 },
            remember: { [weak self] set, sessionID in
                self?.rememberMode(set, for: sessionID)
            },
            rememberRun: { [weak self] pick in self?.runStore.remember(pick) },
        )
    }
}

extension Hub {
    /// The two adapters behind `adapters`, built once — see the property for why once.
    func makeAdapters() -> SessionAdapters {
        SessionAdapters(
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
                terminals: terminals,
                claims: claims,
                attachments: AttachmentStore(root: Self.attachmentRoot),
                patience: spawnServices.permissionPatience,
                // `nil` takes the engine's own pipe host, which needs no window.
                serverHost: spawnServices.codexHost ?? CodexProcessHost(),
            ),
        )
    }

    /// The host that says this window may start agents AT ALL — a Hub built with none is the render
    /// harness and every suite about observation. So a Codex spawn is refused here too, for want of
    /// a host it will not itself use.
    func ptyHost() throws -> AgentProcessHost {
        guard let pty = spawnServices.host else {
            throw AgentSpawnError.hostRefused(detail: "This window cannot start agents")
        }
        return pty
    }
}

@MainActor
public extension Hub {
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
    /// popup — but the resubmit goes through the port anyway: a claim's bytes go to whichever
    /// channel owns them, and a Return typed at a Codex claim would land in the middle of its
    /// JSON-RPC and corrupt a protocol stream rather than fail.
    internal func makeDelivery() -> TurnDelivery {
        TurnDelivery(TurnDelivery.Watch(
            records: { [weak self] sessionID in self?.recordCount(writtenBy: sessionID) ?? 0 },
            submitted: { [weak self] submission, sessionID in
                self?.rememberSubmittedTurn(submission, for: sessionID)
            },
            retype: { [weak self] sessionID in self?.adapters.resubmit(sessionID) ?? false },
            lost: { [weak self] text, sessionID in self?.rememberLostTurn(text, for: sessionID) },
        ))
    }

    /// How much the Session behind this id has written, FOLLOWED ACROSS THE RE-KEY (#1176).
    ///
    /// The watch holds the id the row had when the Turn was typed, and for a fresh Session that is
    /// its claim's — the row is re-keyed to the CLI's own id the moment its first record lands, and
    /// the provisional row stands down. Read straight, the count would come back 0 both before the
    /// record and after it, so the first Turn of every fresh Session would read as silence and be
    /// called lost while the feed drew it running.
    ///
    /// `rowID(ofClaim:)` is the same resolution the handoff edge takes for the same reason, and it
    /// answers an unclaimed id unchanged — so a steady-state Session reads exactly as before.
    internal func recordCount(writtenBy sessionID: String) -> Int {
        session(id: ownership.rowID(ofClaim: sessionID))?.events.count ?? 0
    }

    /// File the Turn Argo just typed at a Session (#1048), against the CLAIM for the reason
    /// `rememberLostTurn` below is, and refused for a Session with no claim for the same reason —
    /// which is also what keeps an external Session off a status only Argo's own channel supports.
    private func rememberSubmittedTurn(
        _ submission: SessionTurnSubmission,
        for sessionID: String,
    ) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.setSubmittedTurn(submission, for: claim)
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
    ///
    /// Read STRAIGHT where `recordCount(writtenBy:)` above resolves the re-key, and immune to it:
    /// this is a baseline taken and used before the `await`, never a reading held across one. A
    /// fresh Session's pre-key row has written no stance record, so the 0 it answers is the true
    /// count rather than a dead row's silence.
    internal func observedModeCount(of sessionID: String) -> Int {
        session(id: sessionID)?.observedModeCount ?? 0
    }

    /// Where one Session stands, off the roster. It is the same reading every surface draws, so the
    /// rung a change is counted from cannot disagree with the rung the footer states.
    private func stance(of sessionID: String) -> SessionStance {
        guard let session = session(id: sessionID) else { return .unknown }
        return SessionStance(
            mode: session.mode,
            isRunning: session.status == .running,
            takesTypedLine: session.status.takesTypedLine,
        )
    }

    /// Where a pasted attachment's bytes land: Argo's own per-machine data, beside `handoffs/`.
    /// Never the Project — see `AttachmentStore` for why the Workspace was the wrong folder.
    static var attachmentRoot: URL {
        handoffRoot
            .deletingLastPathComponent()
            .appending(path: "attachments", directoryHint: .isDirectory)
    }
}
