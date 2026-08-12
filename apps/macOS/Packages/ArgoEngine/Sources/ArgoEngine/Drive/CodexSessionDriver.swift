import Foundation

/// The Codex adapter for the session-drive port: a Turn put to a `codex app-server` Argo already
/// owns (ADR-0024, #548). Verified against `CodexClient.verifiedAgainst`.
///
/// It starts nothing and owns nothing: the claim registry and the thread table are the ones the
/// spawn built, which is why this is a value and not an object.
@MainActor
struct CodexSessionDriver: SessionDriver {
    let ownership: SessionOwnership
    let threads: CodexThreads
    let attachments: AttachmentStore

    /// Codex takes images as input items of the Turn itself, so there is an affordance to draw
    /// (#540). Declared rather than asked of the server at the point of use: the composer has to
    /// know whether to draw the `+` before anything has been dropped on it.
    var canAttach: Bool {
        true
    }

    /// `codex` parses `/` in a TUI composer Argo never touches, so a `/command` put over the thread
    /// arrives as prose the model reads (#685). No picker is drawn rather than one whose commands
    /// quietly do nothing.
    var canRunCommands: Bool {
        false
    }

    func send(_ text: String, to sessionID: String) throws {
        guard SessionTurn.isSendable(text) else { throw SessionDriveError.nothingToSend }
        guard let thread = thread(for: sessionID), thread.send(text) else {
            throw SessionDriveError.notDrivable
        }
    }

    func interrupt(_ sessionID: String) throws {
        guard let thread = thread(for: sessionID), thread.interrupt() else {
            throw SessionDriveError.notDrivable
        }
    }

    /// Checked against the same live thread `send` is, and before a byte is written: an attachment
    /// addressed for a Session that has already gone is a file left on the machine for a Turn that
    /// can never name it.
    ///
    /// Every attachment is named in the Turn's text, as on `claude`. An IMAGE is also handed to the
    /// server as an input item, so the model sees the picture rather than a path it would have to
    /// open — the fidelity difference ADR-0024 records, and the reason both halves have to reach
    /// one Turn.
    func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL] {
        guard let thread = thread(for: sessionID) else { throw SessionDriveError.notDrivable }
        do {
            let paths = try self.attachments.address(attachments, of: sessionID)
            thread.willSend(images: zip(attachments, paths).filter(\.0.isImage).map(\.1))
            return paths
        } catch {
            throw SessionDriveError.attachmentUnwritable
        }
    }

    /// The rung the next Turn starts under. Nothing is sent here and nothing needs to be: a rung
    /// rides on `turn/start` on this surface, so there is no ring to walk and no mid-Turn hazard to
    /// refuse for.
    func setMode(_ mode: SessionMode, for sessionID: String) async throws {
        guard let thread = thread(for: sessionID) else { throw SessionDriveError.notDrivable }
        thread.setMode(mode)
    }

    /// Nothing is ever waiting yet: an approval this adapter receives is declined where it arrives,
    /// because there is no cockpit prompt to raise it on until #549. So the honest answer to
    /// "answer the pending one" is that there is none, and never the silence of a decision that
    /// went nowhere.
    func decide(
        _: PermissionDecision,
        answering _: String,
        for _: String,
    ) throws {
        throw SessionDriveError.nothingPending
    }

    /// A standing allow is granted by answering a Permission `allowAlways`, which this adapter
    /// cannot yet raise (#549) — so a Session here holds none, and a revocation names nothing.
    func revokeStandingAllow(_: String, for _: String) throws {
        throw SessionDriveError.noSuchGrant
    }

    /// `ownerOf` answers only for a claim whose process still lives, so an orphaned Session refuses
    /// on the same fact its provenance is read from rather than on a second rule.
    private func thread(for sessionID: String) -> CodexThread? {
        ownership.ownerOf(sessionID: sessionID).flatMap(threads.thread(for:))
    }
}
