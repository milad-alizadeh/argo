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
    /// Where the Session stands right now, read at the moment a rung is asked for rather than held:
    /// the distance to walk is counted from it, and a copy of it here would be the second answer to
    /// a question the roster already answers.
    let stance: (String) -> SessionStance

    /// Claude reads a path it is handed, which is the whole mechanism (#540). Declared here rather
    /// than asked of the CLI at run time: the composer has to know whether to draw the `+` before
    /// anything has been dropped on it.
    var canAttach: Bool {
        true
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

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        guard let permissions, let claim = ownership.ownerOf(sessionID: sessionID) else {
            throw SessionDriveError.notDrivable
        }
        guard permissions.revoke(toolName, for: claim) else {
            throw SessionDriveError.noSuchGrant
        }
    }
}
