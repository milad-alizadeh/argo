import Foundation

/// The drive port with the rung filed where it landed (#545, #633). It must be the only way to
/// reach the adapter: a `setMode` that skips the record leaves the next change counting from a
/// stale reading, and walking the ring too far widens a boundary nobody asked for.
@MainActor
struct RememberingDriver<Base: SessionDriver>: SessionDriver {
    private let base: Base
    /// Handed the rung only once it landed. A refusal filed as a set is the same stale count.
    private let remember: (SessionMode, String) -> Void

    init(base: Base, remember: @escaping (SessionMode, String) -> Void) {
        self.base = base
        self.remember = remember
    }

    var canAttach: Bool {
        base.canAttach
    }

    func send(_ text: String, to sessionID: String) throws {
        try base.send(text, to: sessionID)
    }

    func interrupt(_ sessionID: String) throws {
        try base.interrupt(sessionID)
    }

    func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL] {
        try base.attach(attachments, to: sessionID)
    }

    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws {
        try base.decide(decision, answering: requestID, for: sessionID)
    }

    func setMode(_ mode: SessionMode, for sessionID: String) throws {
        try base.setMode(mode, for: sessionID)
        remember(mode, sessionID)
    }

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        try base.revokeStandingAllow(toolName, for: sessionID)
    }
}
