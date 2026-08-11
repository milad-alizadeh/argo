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
