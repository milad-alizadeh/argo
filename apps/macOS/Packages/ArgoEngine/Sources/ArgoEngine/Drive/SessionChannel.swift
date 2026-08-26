import Foundation

/// The other half of the session-drive seam: not what Argo does TO a Session, but how the channel
/// to one is opened, fed and closed (#749, widening ADR-0024's extent).
///
/// It is the same two adapters as `SessionDriver` and never a third, because what happens here is
/// one CLI's own protocol: `claude`'s channel IS the PTY, and `codex`'s is a JSON-RPC client on top
/// of one. Before this the Hub held both answers itself — a `switch plan.cli`, a thread table and a
/// host — so per-CLI knowledge accreted in the one module that is supposed to be CLI-blind.
///
/// A protocol beside `SessionDriver` rather than five more members on it, for two reasons. The
/// subject is different: the cockpit drives a Session and never opens one, so nothing above the
/// seam calls any of this. And `AgentSpawnPlan` is internal, which a public port cannot name.
@MainActor
protocol SessionChannel {
    /// Which host starts this plan's surface: the PTY the Hub was given, or one of the adapter's
    /// own. The PTY is passed in rather than reached for, because it is also what says this window
    /// may start agents AT ALL — a Hub built with none is the render harness, and a Codex spawn is
    /// refused for want of a host it will not itself use.
    func host(for plan: AgentSpawnPlan, besides pty: AgentProcessHost) -> AgentProcessHost

    /// Whatever this CLI needs beyond a running process. Called after the process has been adopted,
    /// because a channel that writes to it has nothing to write to before then.
    func open(_ plan: AgentSpawnPlan)

    /// One chunk of this claim's output, offered. `true` where the chunk belonged to this adapter's
    /// own channel, which is what tells the caller not to hand it to anybody else — a claim's bytes
    /// go to exactly one reader, and a JSON-RPC stream kept in a terminal replay buffer would be
    /// there for a viewer that cannot exist.
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool

    /// Submit again what was already typed (#682) — the one thing `TurnDelivery` does that is a
    /// write rather than a reading. `false` where this Session's channel has no such act: only a
    /// keystroke can be eaten by a popup, and a request either reached the server or did not.
    func resubmit(_ sessionID: String) -> Bool

    /// The claim is given up, so every channel it spoke over goes with it.
    func close(_ claim: SessionOwnership.ClaimID)
}
