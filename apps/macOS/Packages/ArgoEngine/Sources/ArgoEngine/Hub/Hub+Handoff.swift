import Foundation

/// The Hub answering the three acts a handoff is made of.
///
/// Each is a fact the Hub already holds and nothing more: which claim owns a Session's PTY, what is
/// on disk at a path, and how to start an agent. The ORDER they go in is `SessionHandoff`'s and is
/// asserted there — this file is only the wiring.
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

    /// The edge, held in memory and written down.
    ///
    /// In memory because what the fresh row is CALLED right now is a claim id, and a claim belongs
    /// to this process (ADR-0013) — the roster reads it back through `rowID(ofClaim:)`. On disk
    /// because the handoff is what a Session PRODUCED, which `CONTEXT.md` keeps as an Outcome.
    ///
    /// The written link is recorded against the CLAIM and named later, when the fresh agent's first
    /// record gives it an id — see `HandoffChain`.
    public func handedOff(sessionID: String, to fresh: String) {
        handoffs[sessionID] = fresh
        chain = chainStore.update { chain in
            chain.record(from: sessionID, claim: fresh, atMs: Date().epochMs)
            return true
        }
    }

    /// The fresh agent has written a record and its claim now has the id the CLI picked. That is
    /// the moment the written link stops being about a claim, so it is the moment it is named.
    ///
    /// Called on every observation batch and answers nothing when there is nothing to name — the
    /// store is only written when a link actually changed.
    func nameChain(claim: SessionOwnership.ClaimID, as sessionID: String) {
        guard chain.links.contains(where: { $0.claim == claim.value && $0.to == nil })
        else { return }
        chain = chainStore.update { chain in chain.name(claim: claim.value, as: sessionID) }
    }

    /// The address `HandoffScript` explains, made concrete: Argo's own per-machine data, beside the
    /// Project registry.
    public static let handoffRoot = ProjectRegistryStore.defaultFileURL
        .deletingLastPathComponent()
        .appending(path: "handoffs", directoryHint: .isDirectory)
}

@MainActor
extension Hub {
    /// The chain as the ROSTER reads it: the links a restart can still follow, plus the ones this
    /// process made a moment ago and has not seen a record for yet.
    ///
    /// The live half wins where both have something to say about a Session — it is the same
    /// handoff, held under the claim that is still the row's id until the rebind happens.
    var followableHandoffs: [String: String] {
        chain.resolved.merging(handoffs) { _, live in live }
    }
}
