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
    /// Handed a Model or an Effort only once the port took it, for the same reason (#1175): a pick
    /// the CLI refused is not the one the next New Session should open on.
    private let rememberRun: (SessionRunPick) -> Void

    init(
        base: Base,
        records: @escaping (String) -> Int,
        remember: @escaping (SessionModeSet, String) -> Void,
        rememberRun: @escaping (SessionRunPick) -> Void,
    ) {
        self.base = base
        self.records = records
        self.remember = remember
        self.rememberRun = rememberRun
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

    /// Remembered APP-WIDE and never against this Session (#1175). Where `setMode` files a rung and
    /// a record count for the Session it was set on, these two file only the pick itself: a model
    /// and an effort are NAMED rather than walked to, and where THIS Session stands on them is a
    /// question its own next record answers. What is kept is what the next New Session opens on.
    func setModel(_ modelID: String, for sessionID: String) async throws {
        try await base.setModel(modelID, for: sessionID)
        rememberRun(.model(modelID))
    }

    func setEffort(_ effort: SessionEffort, for sessionID: String) async throws {
        try await base.setEffort(effort, for: sessionID)
        rememberRun(.effort(effort))
    }

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        try base.revokeStandingAllow(toolName, for: sessionID)
    }
}
