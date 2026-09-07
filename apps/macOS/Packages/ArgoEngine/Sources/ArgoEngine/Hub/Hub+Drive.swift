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
            remembers: .init(
                mode: { [weak self] set, sessionID in
                    self?.rememberMode(set, for: sessionID)
                },
                run: { [weak self] pick in self?.runStore.remember(pick) },
                stoppedTurn: { [weak self] sessionID in
                    self?.rememberStopClaim(for: sessionID)
                },
            ),
        )
    }

    /// Type one title at the Session's own prompt, and answer whether it went (#1494).
    ///
    /// Mirroring the name Argo holds onto the CLI's own Session title, so the same Session reads
    /// the same in Argo's roster, Claude mobile, Claude desktop and the web app.
    ///
    /// Every refusal is swallowed: a `codex` Session, a Session Argo owns no terminal for, a
    /// Permission or a question holding the keyboard. None of them is a failed rename — the
    /// Argo-side name is written already and is what the roster draws. A Turn in flight is no
    /// longer among them (#1658): the harness runs `/rename` itself rather than queueing it.
    ///
    /// The answer is for the caller that can try again. Both callers do: `TicketTitleResolver`
    /// retries a Ticket's words on its next sweep, and `SessionNameMirror` retries the name the
    /// roster draws on its own — which is the difference between one busy moment costing a Session
    /// its name for the launch and costing it a few seconds.
    ///
    /// Ungated on purpose, and the gate is `SessionNameMirror`'s: this types WHATEVER it is handed.
    /// Whether a name of Argo's may replace a title the CLI already holds is a question about where
    /// the name came from, and this port cannot see that (#1623).
    ///
    /// Beside `driver` rather than in the app target: it reads nothing the app owns, and a
    /// derivation there is one no test can reach (ADR-0022).
    func mirrorTitle(_ title: String, to sessionID: String) async -> Bool {
        do {
            try await driver.setTitle(title, for: sessionID)
            return true
        } catch {
            return false
        }
    }

    /// Type the name each row draws at that Session's own prompt, wherever the CLI is not already
    /// on it (#1623) — the sweep behind `names`, and the rule is `SessionNameMirror`'s.
    ///
    /// What each row is CALLED comes in, because the roster's spelling and its Ticket contest are
    /// the cockpit's; where each name stands is read here off `nameStandings`. Beside `mirrorTitle`
    /// above rather than at the window, so the join of the two readings is one a suite can reach
    /// (ADR-0022).
    func mirrorNames(_ draws: [String: SessionNameDraw]) async {
        await names.carry(draws, against: nameStandings)
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
                patience: spawnServices.patience.permission,
                // `nil` takes the engine's own pipe host, which needs no window.
                serverHost: spawnServices.hosts.codex ?? CodexProcessHost(),
            ),
        )
    }

    /// The host that says this window may start agents AT ALL — a Hub built with none is the render
    /// harness and every suite about observation. So a Codex spawn is refused here too, for want of
    /// a host it will not itself use.
    func ptyHost() throws -> AgentProcessHost {
        guard let pty = spawnServices.hosts.pty else {
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
            says: TurnDelivery.Watch.Says(
                records: { [weak self] id in self?.recordCount(writtenBy: id) ?? 0 },
                echo: { [weak self] text, id in
                    self?.adapters.echo(of: text, at: id) ?? .unreadable
                },
            ),
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
    /// `nil` is the watch saying the claim is OVER (#1409) — see `TurnDelivery.over(_:)` and
    /// `ClaimLedger.stopSubmittedTurn`. The reader's own Stop takes `rememberStopClaim` below
    /// instead, which ends the same claim and files Argo's `ESC` in its place (#1644).
    private func rememberSubmittedTurn(
        _ submission: SessionTurnSubmission?,
        for sessionID: String,
    ) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        guard let submission else { return claims.stopSubmittedTurn(for: claim) }
        claims.setSubmittedTurn(submission, for: claim)
    }

    /// File a Turn the CLI never heard (#682), against the CLAIM like every other drive fact: a
    /// fresh Session is re-keyed to its own id the moment its record lands, and news filed under
    /// the id it had before would be lost at the re-key.
    ///
    /// A Session with no claim is one Argo cannot type at, so there was no Turn of ours to lose.
    /// A Turn ARGO steered for a handoff is filed apart from one the reader typed (#1229). The
    /// composer restores what it holds, and the `/handoff` prompt is not the reader's to send
    /// again: it arrives there as a line of Argo's own words with no explanation, and it is the
    /// handoff — waiting on a brief that Turn will now never write — that has to hear about it.
    ///
    /// Told apart by the WORDS and not by the moment: the composer is open while a handoff runs, so
    /// a Turn the reader types into it goes down the same PTY and can be lost the same way, and a
    /// window would file theirs as Argo's and abandon a handoff that was still running.
    internal func rememberLostTurn(_ text: String?, for sessionID: String) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        if let text, text == claims.facts(for: claim).handoffPrompt {
            return claims.setHandoffTurnLost(for: claim)
        }
        claims.setLostTurn(text, for: claim)
    }

    /// The reader stopped the Turn at that Session (#1409, #1644) — see
    /// `ClaimLedger.setStopClaim`, which is the whole rule.
    ///
    /// Against the CLAIM, on `rememberLostTurn` above's reasoning, and refused for a Session with
    /// no claim on the same ground: an external Session is one Argo never typed at, so there was no
    /// `ESC` of ours to have sent.
    ///
    /// The count is read HERE and nowhere lower, because here is the last place that knows it: the
    /// ledger is keyed by claim and holds no record, and by the time the roster publishes the
    /// facts, the count has moved on. `recordCount(writtenBy:)` is the same resolution the
    /// submission's own count takes, so the two claims are spent against the same number.
    func rememberStopClaim(for sessionID: String) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.setStopClaim(
            SessionStopClaim(recordsWhenStopped: recordCount(writtenBy: sessionID)),
            for: claim,
        )
    }

    /// The composer has the words back, so the news is spent. Taken back rather than left standing:
    /// a Turn reported lost twice is one the reader would put back twice.
    func clearLostTurn(for sessionID: String) {
        rememberLostTurn(nil, for: sessionID)
    }

    /// The reader has ended one backgrounded delegation from the rail (#1267).
    ///
    /// Against the CLAIM, on `rememberLostTurn` above's reasoning, and refused for a Session with
    /// no claim on the same ground: an external Session is one Argo cannot type at either, so there
    /// is no composer of ours for this to give back.
    ///
    /// It takes the delegation's own call id and not the chip's position: the rail re-numbers its
    /// rows whenever a delegation lands, and a position filed here would end whichever child that
    /// number reached next.
    func endDelegation(callID: String, for sessionID: String) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.endDelegation(callID, for: claim)
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
            takesSlashCommand: session.status.takesSlashCommand,
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
