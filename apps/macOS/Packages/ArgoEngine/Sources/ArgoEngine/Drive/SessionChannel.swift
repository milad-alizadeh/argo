import Foundation

/// The other half of the session-drive seam: not what Argo does TO a Session but how the channel to
/// one is opened, fed and closed (#749, widening ADR-0024's extent).
///
/// Internal where `SessionDriver` is public, and separate for that reason: nothing above the seam
/// calls any of these, and `AgentSpawnPlan` is internal.
@MainActor
protocol SessionChannel {
    /// Which host starts this plan's surface: the PTY the Hub was given, or one of the adapter's
    /// own. Passed in rather than reached for, because the PTY host is also what says this window
    /// may start agents at all.
    func host(for plan: AgentSpawnPlan, besides pty: AgentProcessHost) -> AgentProcessHost

    /// Whatever this CLI needs beyond a running process. Called after the process is adopted, so a
    /// channel that writes to it has something to write to.
    func open(_ plan: AgentSpawnPlan)

    /// One chunk of this claim's output, offered. `true` where this adapter's own channel took it,
    /// which tells the caller not to offer it to anybody else: a claim's bytes go to exactly one
    /// reader, and a JSON-RPC stream kept in a terminal replay buffer would be there for a viewer
    /// that cannot exist.
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool

    /// Submit again what was already typed (#682). `false` where this channel has no such act: only
    /// a keystroke can be eaten by a popup, and a request either reached the server or did not.
    func resubmit(_ sessionID: String) -> Bool

    /// The claim is given up, so every channel it spoke over goes with it.
    func close(_ claim: SessionOwnership.ClaimID)
}
