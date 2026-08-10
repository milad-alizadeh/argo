import Foundation

/// The Hub answering the three acts a handoff is made of.
///
/// Each is a fact the Hub already holds and nothing more: which claim owns a Session's PTY, what is
/// on disk at a path, and how to start an agent. The ORDER they go in is `SessionHandoff`'s and is
/// asserted there — this file is the wiring, so that the sequence can be proved without a `claude`
/// and the wiring can be proved without a clock.
@MainActor
extension Hub: HandoffHost {
    /// `false` for an external Session, and for an orphaned one whose claim outlived its PTY —
    /// which is the same answer `ownerOf` gives, from the same fact.
    public func steer(sessionID: String, typing text: String) -> Bool {
        guard let claim = ownership.ownerOf(sessionID: sessionID) else { return false }
        return terminals.write(text, to: claim)
    }

    /// Whatever is at the path, verbatim. Whether what is there COUNTS as a brief is the
    /// orchestration's rule and is decided there — this reads a file.
    public func brief(at path: String) -> String? {
        try? String(contentsOfFile: path, encoding: .utf8)
    }

    public func spawn(_ seed: SessionSeed) async throws -> String {
        try await spawnSession(seed: seed).value
    }

    /// The edge, held for the life of this process and no longer.
    ///
    /// In memory for the reason `SessionOwnership` is (ADR-0013): what the fresh row is CALLED is a
    /// claim id until its CLI writes a record, and a claim cannot be re-adopted by a later Argo. A
    /// restart therefore forgets the chain — and forgets it in the one direction that stays honest,
    /// because the same restart demotes the handed-off Session to `orphaned`, which offers no
    /// button to press and no fresh row to point at either. The briefs on disk under `handoffs/`
    /// are what a durable chain would be DERIVED from the day one is wanted; a stored link would be
    /// Argo owning a fact it can no longer stand behind.
    public func handedOff(sessionID: String, to fresh: String) {
        handoffs[sessionID] = fresh
    }

    /// The address `HandoffScript` explains, made concrete: Argo's own per-machine data, beside the
    /// Project registry.
    public static let handoffRoot = ProjectRegistryStore.defaultFileURL
        .deletingLastPathComponent()
        .appending(path: "handoffs", directoryHint: .isDirectory)
}
