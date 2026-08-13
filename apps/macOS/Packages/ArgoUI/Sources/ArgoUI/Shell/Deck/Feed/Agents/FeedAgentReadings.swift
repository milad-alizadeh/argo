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

    /// What the deck's one feed draws under a scope: the Subagent's rows, or the Session's.
    ///
    /// A scope is honoured only while the rail is still LISTING — the rail is the only way back out
    /// of a Subagent, so a scope that outlived it would strand the reader in a feed with no chip to
    /// click. A fan-out whose last delegation lands takes the rail off screen, and the reading has
    /// to come back with it.
    ///
    /// It also falls back for an Agent that has left the list, and for one whose reading has gone —
    /// both live-transcript cases, since a chip is only offered where there was a reading to offer.
    func rows(under scope: FeedScope, of agents: [FeedAgent], otherwise feed: [FeedRow])
        -> [FeedRow] {
        guard agents.contains(where: \.isRunning),
              let selected = scope.agent,
              let agent = agents.first(where: { $0.id == selected }),
              let rows = rows(of: agent) else { return feed }
        return rows
    }
}
