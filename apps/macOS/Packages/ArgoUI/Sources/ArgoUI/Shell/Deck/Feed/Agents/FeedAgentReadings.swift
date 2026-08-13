import ArgoEngine

/// Each Subagent's own reading, keyed by the CLI's id for it.
///
/// A VALUE the deck is handed, not something a view reads. The files behind it are the engine's to
/// discover and tail (#711). Empty is the honest default AND the ordinary case — most Sessions
/// delegate nothing, and Codex writes no such record at all.
struct FeedAgentReadings: Equatable, Sendable {
    private let events: [String: [TranscriptEvent]]

    static let none = FeedAgentReadings()

    init(events: [String: [TranscriptEvent]] = [:]) {
        self.events = events
    }

    /// One Subagent's rows, or `nil` where Argo does not have its record.
    ///
    /// `nil` rather than an empty reading, and the two are different claims: no rows would say the
    /// Agent did nothing, where this says nobody has read it. It is what makes a chip selectable —
    /// degrade-down, so a chip Argo cannot scope onto is navigation that stays quiet rather than a
    /// control that empties the feed.
    func rows(of agent: FeedAgent) -> [FeedRow]? {
        guard let id = agent.subagentID, let read = events[id] else { return nil }
        return FeedProjection.rows(from: read)
    }
}
