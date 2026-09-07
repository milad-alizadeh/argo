import Foundation

/// The one Hub fact the cockpit reads through a call rather than off the roster (#858).
///
/// Off the roster it would be republished with the roster, and a fan-out's files move continuously
/// while nothing on the roster does — which is the whole reason `SubagentReadings` sits beside the
/// join rather than in it. Its own file for that reason too: `Hub+Roster` is what the roster
/// publishes, and this is deliberately not that.
@MainActor
public extension Hub {
    /// One Subagent's own reading, or nothing where Argo has not read its file. `FeedAgentReader`
    /// is who asks, and `SubagentReadings.reading(of:)` says when the answer is nothing.
    func subagentReading(of agentID: String) -> [TranscriptEvent]? {
        subagents.reading(of: agentID)
    }

    /// When Argo last watched this Subagent's own file GROW, or nothing where it has not seen it
    /// grow — the evidence the parent's own record cannot hold (`SubagentWriting`, #1269).
    ///
    /// Read through a call for the reason the reading above is: it moves whenever any fan-out
    /// writes, and off the roster it would republish the roster with it (#858).
    func subagentGrewAtMs(of agentID: String) -> Int? {
        subagents.lastGrewAtMs(of: agentID)
    }

    /// The same evidence for EVERY Subagent Argo is tailing, in one table (#1572).
    ///
    /// A call, like the two above, and with the same consequence: a surface that asks is woken
    /// whenever a fan-out writes (#858).
    func subagentGrowth() -> [String: Int] {
        subagents.growth()
    }
}
