import Foundation

/// The Claude adapter for the session-drive port: a Turn typed at the prompt of a `claude` Argo
/// already owns.
///
/// It starts nothing and owns nothing. The PTY host, the claim registry and the terminal table are
/// all the ones the spawn already built — this reuses them, because a second way to reach an agent
/// is a second answer to "is this Session steerable" and they would disagree the first time one of
/// them missed a release.
///
/// A value rather than an object for that reason: there is no state here to be the second copy of.
@MainActor
struct ClaudeSessionDriver: SessionDriver {
    let ownership: SessionOwnership
    let terminals: AgentTerminals
    let permissions: PermissionChannel?
    let attachments: AttachmentStore
    /// Who watches for the CLI answering a Turn that was typed at it (#682).
    let delivery: TurnDelivery
    /// Where the Session stands right now, read at the moment a rung is asked for rather than held:
    /// the distance to walk is counted from it, and a copy of it here would be the second answer to
    /// a question the roster already answers.
    let stance: (String) -> SessionStance

    /// All three, each for a reason of its own. Claude reads a path it is handed, which is the
    /// whole attachment mechanism (#540). A `/command` in the bracketed-paste burst `send` writes
    /// reaches the same input machinery typing reaches, and fires — verified against the real CLI
    /// in `LiveCommandTests`, so that half is only as true as that run (#589). And an `@path` in
    /// the same burst is expanded by the CLI, so Argo naming the file again would hand the same
    /// bytes over twice (#687).
    func surface(of _: String) -> DriveSurface {
        DriveSurface(
            takesAttachments: true,
            runsCommands: true,
            resolvesMentions: true,
            // Both, because `/model` and `/effort` are this CLI's own commands and reach the same
            // input machinery a Turn does — the mechanism `runsCommands` is already true for.
            chooses: .both,
        )
    }

    func send(_ text: String, to sessionID: String) throws {
        guard SessionTurn.isSendable(text) else { throw SessionDriveError.nothingToSend }
        // `ownerOf` answers only for a claim whose PTY still lives, so an orphaned Session refuses
        // here on the same fact its provenance is read from rather than on a second rule.
        guard let claim = ownership.ownerOf(sessionID: sessionID),
              terminals.write(ClaudeTurn.keystrokes(for: text), to: claim)
        else {
            throw SessionDriveError.notDrivable
        }
        // Written is not heard (#682). What answers that is the CLI's own record, which arrives
        // long after this call has returned — so the watch starts here and reports for itself.
        delivery.typed(text, to: sessionID)
    }

    /// One `ESC` at the prompt (#541). It goes through the same claim `send` does — an interrupt
    /// is a keystroke like any other, and the one thing that can stop it reaching the agent is
    /// what stops a Turn: no PTY left to write to.
    func interrupt(_ sessionID: String) throws {
        guard let claim = ownership.ownerOf(sessionID: sessionID),
              terminals.write(ClaudeInterrupt.keystroke, to: claim)
        else {
            throw SessionDriveError.notDrivable
        }
    }

    /// Checked against the same live claim `send` is, and before a byte is written: an attachment
    /// given an address for a Session that has already gone is a file left on the machine for a
    /// Turn that can never name it.
    func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL] {
        guard ownership.ownerOf(sessionID: sessionID) != nil else {
            throw SessionDriveError.notDrivable
        }
        do {
            return try self.attachments.address(attachments, of: sessionID)
        } catch {
            throw SessionDriveError.attachmentUnwritable
        }
    }

    /// The rung is walked to, not written: one `shift+tab` per step, each its OWN write with a gap
    /// behind it. A stance Argo cannot establish leaves no honest distance to walk, so it refuses
    /// rather than guessing.
    ///
    /// The spacing is not politeness — see `ClaudeModeCycle.gap`. Every back-tab in one read is
    /// one mode change to the TUI, so the walk has to arrive as separate reads or it lands a rung
    /// short of wherever it was going (#653).
    func setMode(_ mode: SessionMode, for sessionID: String) async throws {
        guard let claim = ownership.ownerOf(sessionID: sessionID) else {
            throw SessionDriveError.notDrivable
        }
        let standing = stance(sessionID)
        guard !standing.isRunning else { throw SessionDriveError.modeBusy }
        guard let observed = standing.mode.cliValue,
              let steps = ClaudePermissionMode.cycles(from: observed, to: mode)
        else { throw SessionDriveError.modeUnreachable }
        // A second walk would count from a stance the first has already left, so it is refused for
        // the reason a mid-Turn change is: the rung it landed on would be nobody's choice.
        guard terminals.beginWalk(on: claim) else { throw SessionDriveError.modeWalking }
        defer { terminals.endWalk(on: claim) }
        for _ in 0 ..< steps {
            guard terminals.write(ClaudeModeCycle.keystroke, to: claim) else {
                throw SessionDriveError.notDrivable
            }
            await ClaudeModeCycle.pace()
        }
    }

    /// `/model <id>` at the prompt. Nothing is walked and nothing is counted: unlike a rung, a
    /// model is NAMED rather than reached, so the Session's own reading is not read here at all —
    /// only whether a Turn is in flight, which is what would queue the line instead of running it.
    func setModel(_ modelID: String, for sessionID: String) async throws {
        try await run(ClaudeRunFacts.modelLine(modelID), on: sessionID)
    }

    func setEffort(_ effort: SessionEffort, for sessionID: String) async throws {
        try await run(ClaudeRunFacts.effortLine(effort), on: sessionID)
    }

    /// One slash command typed at the prompt, the way a Turn is typed. It does NOT go through
    /// `send`: `send` opens a Turn watch (#682) and clears the composer's draft on the CLI hearing
    /// it, and neither belongs to a line that sets a knob rather than asking for work.
    private func run(_ line: String, on sessionID: String) async throws {
        guard let claim = ownership.ownerOf(sessionID: sessionID) else {
            throw SessionDriveError.notDrivable
        }
        // Mid-Turn the CLI queues a typed line as the NEXT prompt rather than running it, so it
        // would surface in the feed as something the user said. Refused with the reason instead.
        //
        // And on the same guard, a Session blocked on a Permission or a question (#1217): there
        // the keyboard belongs to a DIALOG, so the line is eaten by it and the Return behind the
        // line answers whatever it had highlighted — see `SessionStatus.takesTypedLine`.
        guard stance(sessionID).takesTypedLine else { throw SessionDriveError.runFactsBusy }
        guard terminals.write(ClaudeTurn.keystrokes(for: line), to: claim) else {
            throw SessionDriveError.notDrivable
        }
    }

    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws {
        guard let permissions, let claim = ownership.ownerOf(sessionID: sessionID) else {
            throw SessionDriveError.notDrivable
        }
        guard permissions.decide(decision, answering: requestID, for: claim) else {
            throw SessionDriveError.nothingPending
        }
    }

    func answer(
        _ answer: AskAnswer,
        answering askID: String,
        for sessionID: String,
    ) throws {
        guard let permissions, let claim = ownership.ownerOf(sessionID: sessionID) else {
            throw SessionDriveError.notDrivable
        }
        guard permissions.answer(answer, answering: askID, for: claim) else {
            throw SessionDriveError.nothingPending
        }
    }

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        guard let permissions, let claim = ownership.ownerOf(sessionID: sessionID) else {
            throw SessionDriveError.notDrivable
        }
        guard permissions.revoke(toolName, for: claim) else {
            throw SessionDriveError.noSuchGrant
        }
    }
}
