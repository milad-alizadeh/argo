import Foundation

/// The `codex` half of the channel seam (#749). A Codex spawn is a JSON-RPC client as well as a
/// process, and all of this used to sit in `Hub+Spawn.swift` — which made the Hub the de-facto
/// third adapter. The deletion test is the argument: taken out of the Hub the complexity does not
/// vanish, it reappears in one place, and that place is the adapter that holds the threads already.
extension CodexSessionDriver: SessionChannel {
    /// Pipes, not the PTY it was handed: app-server speaks newline-delimited JSON-RPC over stdio,
    /// and a PTY between the two would echo every line Argo wrote back into the stream it parses.
    func host(for _: AgentSpawnPlan, besides _: AgentProcessHost) -> AgentProcessHost {
        serverHost
    }

    /// Ask the freshly started server for a thread, and put the seed's prompt to it. Queued rather
    /// than sent: the thread does not exist until the server says it does.
    func open(_ plan: AgentSpawnPlan) {
        let thread = CodexThread(
            cwd: plan.cwd,
            mode: plan.mode,
            approvals: approvals(under: plan.claim),
            channel: channel(under: plan.claim),
        )
        threads.open(plan.claim, thread: thread)
        guard let opening = plan.seed.opening else { return }
        _ = thread.send(opening)
    }

    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool {
        threads.received(chunk, from: claim)
    }

    /// Nothing to resubmit: a Turn on this surface is a request the server either accepted or
    /// refused, so there is no keystroke for a popup to eat (#682).
    func resubmit(_: String) -> Bool {
        false
    }

    func close(_ claim: SessionOwnership.ClaimID) {
        threads.close(claim)
    }

    /// The gate over that thread. Filed under the CLAIM like every other gate reading, so a
    /// Permission raised before the CLI wrote a record survives the re-key to the id it picks.
    private func approvals(under claim: SessionOwnership.ClaimID) -> CodexApprovals {
        CodexApprovals(
            patience: patience,
            publish: { [claims] readings in claims.publish(readings, for: claim) },
            write: write(to: claim),
        )
    }

    private func channel(under claim: SessionOwnership.ClaimID) -> CodexChannel {
        CodexChannel(
            write: write(to: claim),
            report: { [claims] status in claims.publish(driveStatus: status, for: claim) },
        )
    }

    /// One line to that claim's server. Down the process table like a keystroke, because what a
    /// claim owns is a process either way — what differs is that these bytes are a protocol.
    private func write(to claim: SessionOwnership.ClaimID) -> @MainActor (String) -> Bool {
        { [terminals] line in terminals.write(line, to: claim) }
    }
}
