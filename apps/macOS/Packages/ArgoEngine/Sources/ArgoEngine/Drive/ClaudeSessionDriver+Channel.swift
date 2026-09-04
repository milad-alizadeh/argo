import Foundation

/// The `claude` half of the channel seam (#749). There is almost nothing here, and that is the
/// claim: the PTY IS the channel, so every act below is the terminal table's.
extension ClaudeSessionDriver: SessionChannel {
    /// The PTY it was handed. The interactive TUI in a terminal is the surface that keeps
    /// subscription billing (ADR-0024), so there is no second answer this could give.
    func host(for _: AgentSpawnPlan, besides pty: AgentProcessHost) -> AgentProcessHost {
        pty
    }

    /// Nothing to open on top of a PTY.
    func open(_: AgentSpawnPlan) {}

    /// Every chunk, always: this adapter cannot tell a claim of its own from anybody else's, so it
    /// can only ever be offered a chunk LAST.
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool {
        terminals.received(chunk, from: claim)
        return true
    }

    /// The composer at the bottom of this claim's own PTY, read for whether it is still holding
    /// the Turn (#1266). `unreadable` covers every way there is nothing to read: a claim whose PTY
    /// has gone, a Hub with no emulator wired, and a screen with no prompt row painted on it yet.
    func echo(of text: String, at sessionID: String) -> TurnEcho {
        guard let claim = ownership.ownerOf(sessionID: sessionID),
              let rows = terminals.rows(of: claim)
        else {
            return .unreadable
        }
        return ComposerEcho.reading(of: text, on: rows)
    }

    /// One bare Return at the prompt, for the Turn whose own Return a popup ate (#682).
    func resubmit(_ sessionID: String) -> Bool {
        guard let claim = ownership.ownerOf(sessionID: sessionID) else { return false }
        return terminals.write(ClaudeTurn.submit, to: claim)
    }

    func close(_ claim: SessionOwnership.ClaimID) {
        terminals.drop(claim)
    }
}
