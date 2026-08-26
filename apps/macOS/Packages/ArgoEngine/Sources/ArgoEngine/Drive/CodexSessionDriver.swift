import Foundation

/// The Codex adapter for the session-drive port: a Turn put to a `codex app-server` Argo already
/// owns (ADR-0024, #548). Verified against `CodexClient.verifiedAgainst`.
///
/// The thread table is ITS OWN (#749) — the Hub held one before, and holding it was most of what
/// made the Hub a third adapter. Everything else is the spawn's: the claim registry, the process
/// table and the claim ledger are the ones every other reading is taken through, because a second
/// way to reach an agent is a second answer to "is this Session steerable".
@MainActor
struct CodexSessionDriver: SessionDriver {
    let ownership: SessionOwnership
    /// The processes behind the claims. A Codex Session has no PTY to draw, but it has a process,
    /// and its stdin is where a JSON-RPC line goes.
    let terminals: AgentTerminals
    /// Where a gate reading is published, keyed by claim.
    let claims: ClaimLedger
    let attachments: AttachmentStore
    /// How long a Codex approval may sit unanswered before the adapter declines it itself — the
    /// WHOLE mechanism on this surface, because the server keeps no clock (ADR-0024).
    let patience: PermissionPatience
    /// What starts a `codex app-server`: pipes rather than a PTY (`CodexProcessHost`). The seam is
    /// still there for a suite that must not start a real one.
    let serverHost: AgentProcessHost
    /// The Codex threads Argo holds, one per claim. Empty on an Argo that has spawned no `codex`,
    /// which is also what tells `SessionAdapters` a Session is a Codex one.
    let threads = CodexThreads()

    /// Codex takes images as input items of the Turn itself, so there is an affordance to draw
    /// (#540). Declared rather than asked of the server at the point of use: the composer has to
    /// know whether to draw the `+` before anything has been dropped on it.
    var canAttach: Bool {
        true
    }

    /// `codex` parses `/` in a TUI composer Argo never touches, so a `/command` put to this surface
    /// arrives at the model as prose (#685). A Session here draws no picker at all.
    func canRunCommands(for _: String) -> Bool {
        false
    }

    /// `codex` has no mention machinery at all, so an `@path` would arrive as prose. Argo names the
    /// file on its own line instead, which is why the `@` menu is offered here and the `/` one is
    /// not.
    func resolvesMentions(for _: String) -> Bool {
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

    /// A JSON-RPC response to the request the server is blocked on (#549) — the whole of how an
    /// approval is decided on this surface. Keyed by request like `claude`'s, and for the same
    /// reason: a Session can have more than one call waiting, so answering "whatever is pending"
    /// would spend the user's Allow on the prompt that replaced the one they read.
    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws {
        guard let thread = thread(for: sessionID) else { throw SessionDriveError.notDrivable }
        guard thread.approvals.decide(decision, answering: requestID) else {
            throw SessionDriveError.nothingPending
        }
    }

    /// Nothing on this surface can be asking (#712). `AskUserQuestion` is a `claude` tool behind a
    /// `claude` hook, and `codex app-server` has no request of that shape — so there is never a
    /// question here to name, and an answer is refused rather than sent somewhere it might fit.
    func answer(
        _: AskAnswer,
        answering _: String,
        for sessionID: String,
    ) throws {
        guard thread(for: sessionID) != nil else { throw SessionDriveError.notDrivable }
        throw SessionDriveError.nothingPending
    }

    /// The grant is Argo's own, not the server's (#572). `acceptForSession` would make the SERVER
    /// stop asking with no way back, so the standing allow lives on this side of the wire — which
    /// is what leaves a revocation something to take.
    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        guard let thread = thread(for: sessionID) else { throw SessionDriveError.notDrivable }
        guard thread.approvals.revoke(toolName) else { throw SessionDriveError.noSuchGrant }
    }

    /// Whether this Session is one of Argo's Codex threads — true exactly while Argo holds a live
    /// one for it, which is the fact `SessionAdapters` routes on and the same fact `ownerOf` grades
    /// steerability on.
    ///
    /// The table and not the Session's `cli`: `cli` is read off a record, and a fresh Codex Session
    /// has none until its CLI writes one — so routing on it would send that Session's first Turn to
    /// the `claude` adapter, which holds no process of its own for it.
    func holdsThread(for sessionID: String) -> Bool {
        thread(for: sessionID) != nil
    }

    /// `ownerOf` answers only for a claim whose process still lives, so an orphaned Session refuses
    /// on the same fact its provenance is read from rather than on a second rule.
    private func thread(for sessionID: String) -> CodexThread? {
        ownership.ownerOf(sessionID: sessionID).flatMap(threads.thread(for:))
    }
}
