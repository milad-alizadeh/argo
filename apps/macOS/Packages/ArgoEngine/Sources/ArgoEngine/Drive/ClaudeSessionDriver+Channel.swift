import Foundation

/// The `claude` half of the channel seam (#749). There is almost nothing here, and that is the
/// claim: the PTY *is* the channel, so opening one is what the spawn already did and every act
/// below is the terminal table's.
extension ClaudeSessionDriver: SessionChannel {
    /// The PTY it was handed. This adapter has no host of its own — the interactive TUI in a
    /// terminal is the surface that keeps subscription billing (ADR-0024), so there is no second
    /// answer it could give.
    func host(for _: AgentSpawnPlan, besides pty: AgentProcessHost) -> AgentProcessHost {
        pty
    }

    /// Nothing to open on top of a PTY.
    func open(_: AgentSpawnPlan) {}

    /// Every chunk, always: a PTY carries whatever the TUI drew, and the replay buffer is what a
    /// viewer attaching later reads back. So this adapter can only ever be OFFERED a chunk last —
    /// it has no way to tell a claim of its own from anybody else's, and it takes them all.
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool {
        terminals.received(chunk, from: claim)
        return true
    }

    /// One bare Return at the prompt, for the Turn whose own Return the file-mention popup ate
    /// (#682).
    func resubmit(_ sessionID: String) -> Bool {
        guard let claim = ownership.ownerOf(sessionID: sessionID) else { return false }
        return terminals.write(ClaudeTurn.submit, to: claim)
    }

    func close(_ claim: SessionOwnership.ClaimID) {
        terminals.drop(claim)
    }
}
