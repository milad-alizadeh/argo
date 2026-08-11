import Foundation

/// The Hub answering the three acts a handoff is made of.
///
/// Each is a fact the Hub already holds and nothing more: which claim owns a Session's PTY, what is
/// on disk at a path, and how to start an agent. The ORDER they go in is `SessionHandoff`'s and is
/// asserted there — this file is only the wiring.
@MainActor
extension Hub: HandoffHost {
    /// Typing at a prompt is what a Turn IS, so it goes through the driver rather than writing the
    /// PTY itself — one spelling of Return reaches the CLI, not two that can drift (#628).
    ///
    /// `false` wherever the driver refuses, which for a non-empty command means Argo owns no live
    /// PTY: an external Session, or an orphaned one whose claim outlived its own.
    public func steer(sessionID: String, typing text: String) -> Bool {
        (try? driver.send(text, to: sessionID)) != nil
    }

    /// Whatever is at the path, verbatim. Whether what is there COUNTS as a brief is the
    /// orchestration's rule and is decided there — this reads a file.
    public func brief(at path: String) -> String? {
        try? String(contentsOfFile: path, encoding: .utf8)
    }

    public func spawn(_ seed: SessionSeed) async throws -> String {
        try await spawnSession(seed: seed).value
    }

    /// The edge, recorded against the CLAIM the fresh row was published under and named later, when
    /// the fresh agent's first record gives it an id — see `HandoffLedger`.
    public func handedOff(sessionID: String, to fresh: String) {
        handoff.record(
            from: sessionID,
            claim: SessionOwnership.ClaimID(value: fresh),
            atMs: Date().epochMs,
        )
    }

    /// The address `HandoffScript` explains, made concrete: Argo's own per-machine data, beside the
    /// Project registry.
    public static let handoffRoot = ProjectRegistryStore.defaultFileURL
        .deletingLastPathComponent()
        .appending(path: "handoffs", directoryHint: .isDirectory)
}
