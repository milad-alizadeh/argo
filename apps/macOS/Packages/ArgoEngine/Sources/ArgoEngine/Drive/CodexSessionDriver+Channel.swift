import Foundation

/// The `codex` half of the channel seam (#749): a Codex spawn is a JSON-RPC client as well as a
/// process, and this is the whole of what that costs beyond one.
extension CodexSessionDriver: SessionChannel {
    /// Pipes, not the PTY it was handed: app-server speaks newline-delimited JSON-RPC over stdio,
    /// and a PTY between the two would echo every line Argo wrote back into the stream it parses.
    func host(for _: AgentSpawnPlan, besides _: AgentProcessHost) -> AgentProcessHost {
        serverHost
    }

    /// Ask the started server for a thread, and put the seed's prompt to it. Queued rather than
    /// sent: the thread does not exist until the server says it does.
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

    /// No surface to read: a Turn here is a request over JSON-RPC, and there is no composer for
    /// one to sit in. Nothing ever watches a Codex Turn either — see `Hub.makeDelivery`.
    func echo(of _: String, at _: String) -> TurnEcho {
        .unreadable
    }

    /// Nothing to resubmit: a Turn here is a request the server accepted or refused, so there is no
    /// keystroke for a popup to eat (#682).
    func resubmit(_: String) -> Bool {
        false
    }

    func close(_ claim: SessionOwnership.ClaimID) {
        threads.close(claim)
    }

    /// Filed under the CLAIM like every other gate reading, so a Permission raised before the CLI
    /// wrote a record survives the re-key to the id it picks.
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

    /// One line to that claim's server, down the process table like a keystroke: what a claim owns
    /// is a process either way, and what differs is that these bytes are a protocol.
    private func write(to claim: SessionOwnership.ClaimID) -> @MainActor (String) -> Bool {
        { [terminals] line in terminals.write(line, to: claim) }
    }
}
