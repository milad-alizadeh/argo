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
            throw SessionDriveError.nothingPending
        }
    }
}
