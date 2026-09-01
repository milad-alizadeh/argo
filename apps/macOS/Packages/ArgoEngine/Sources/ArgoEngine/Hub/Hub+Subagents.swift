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
}
