import Foundation

/// The drive port with the rung filed where it landed (#545, #633). It must be the only way to
/// reach the adapter: a `setMode` that skips the record leaves the next change counting from a
/// stale reading, and walking the ring too far widens a boundary nobody asked for.
@MainActor
struct RememberingDriver<Base: SessionDriver>: SessionDriver {
    private let base: Base
    /// How many stance records the Session has written, read BEFORE the walk: the ring is walked a
    /// keystroke at a time with the roster live in between, so a count read afterwards could
    /// already include a record the walk itself provoked (#653).
    private let records: (String) -> Int
    /// Handed the rung only once it landed. A refusal filed as a set is the same stale count.
    private let remember: (SessionModeSet, String) -> Void

    init(
        base: Base,
        records: @escaping (String) -> Int,
        remember: @escaping (SessionModeSet, String) -> Void,
    ) {
        self.base = base
        self.records = records
        self.remember = remember
    }

    func surface(of sessionID: String) -> DriveSurface {
        base.surface(of: sessionID)
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

    func answer(
        _ answer: AskAnswer,
        answering askID: String,
        for sessionID: String,
    ) throws {
        try base.answer(answer, answering: askID, for: sessionID)
    }

    func setMode(_ mode: SessionMode, for sessionID: String) async throws {
        let before = records(sessionID)
        try await base.setMode(mode, for: sessionID)
        remember(SessionModeSet(mode: mode, recordsWhenSet: before), sessionID)
    }

    /// Passed straight through, and nothing is remembered (#558). What `setMode` files exists
    /// because the ring is walked from a reading that a set invalidates; a model and an effort are
    /// NAMED rather than walked to, and the CLI's own next record is what states where they landed.
    /// Filing them here would be a second answer to a question the transcript already answers.
    func setModel(_ modelID: String, for sessionID: String) async throws {
        try await base.setModel(modelID, for: sessionID)
    }

    func setEffort(_ effort: SessionEffort, for sessionID: String) async throws {
        try await base.setEffort(effort, for: sessionID)
    }

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        try base.revokeStandingAllow(toolName, for: sessionID)
    }
}
