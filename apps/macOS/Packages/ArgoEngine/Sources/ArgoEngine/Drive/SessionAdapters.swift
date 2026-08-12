import Foundation

/// The drive port with the adapter chosen per Session (ADR-0024).
///
/// The choice is made HERE and not at the surface that raised the intent: a composer that had to
/// know which CLI it was talking to would be a cockpit change every time an adapter is added, which
/// is the one thing the port exists to prevent.
///
/// It is made on the THREAD TABLE rather than on the Session's `cli`, because that table is Argo's
/// own fact about a Session it holds a process for. `cli` is read off a record and is absent until
/// one arrives — so routing on it would send the first Turn of a fresh Codex Session down the
/// `claude` adapter, which holds no PTY for it and would refuse.
@MainActor
struct SessionAdapters: SessionDriver {
    let claude: ClaudeSessionDriver
    let codex: CodexSessionDriver
    /// Whether this Session is one of Argo's Codex threads.
    let isCodex: (String) -> Bool

    /// What the composer draws before anything has been dropped on it. Both adapters take
    /// attachments, by unlike means (ADR-0024), so the answer is the same whichever Session is
    /// live — which is why it can be one value at all. An adapter that took none would make this a
    /// per-Session reading, and the port has no Session to read it for.
    var canAttach: Bool {
        claude.canAttach && codex.canAttach
    }

    func send(_ text: String, to sessionID: String) throws {
        try adapter(for: sessionID).send(text, to: sessionID)
    }

    func interrupt(_ sessionID: String) throws {
        try adapter(for: sessionID).interrupt(sessionID)
    }

    func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL] {
        try adapter(for: sessionID).attach(attachments, to: sessionID)
    }

    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws {
        try adapter(for: sessionID).decide(decision, answering: requestID, for: sessionID)
    }

    func setMode(_ mode: SessionMode, for sessionID: String) async throws {
        try await adapter(for: sessionID).setMode(mode, for: sessionID)
    }

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        try adapter(for: sessionID).revokeStandingAllow(toolName, for: sessionID)
    }

    private func adapter(for sessionID: String) -> any SessionDriver {
        isCodex(sessionID) ? codex : claude
    }
}
