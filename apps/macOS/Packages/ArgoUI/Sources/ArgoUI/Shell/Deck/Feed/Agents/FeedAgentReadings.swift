import ArgoEngine

/// Each Subagent's own reading, keyed by the CLI's id for it.
///
/// A VALUE the deck is handed, not something a view reads. The files behind it are the engine's to
/// discover and tail (#711). Empty is the honest default AND the ordinary case — most Sessions
/// delegate nothing, and Codex writes no such record at all.
struct FeedAgentReadings: Equatable, Sendable {
    private let events: [String: [TranscriptEvent]]
    /// Which version of the Session's record these came from, and `nil` for a value nobody stamped
    /// — a specimen, a `#Preview`, a suite. The two derivations below are memoised under it, so the
    /// deck's zones and the toolbar's evidence toggle ask the same question once (#875, ADR-0028
    /// Rule 1). Unstamped simply derives, which is what it did before.
    private let stamp: SessionsRoomReadingCache.Stamp?

    static let none = FeedAgentReadings()

    init(
        events: [String: [TranscriptEvent]] = [:],
        stamp: SessionsRoomReadingCache.Stamp? = nil,
    ) {
        self.events = events
        self.stamp = stamp
    }

    /// The RECORD, never the stamp: the stamp moves on facts these rows are not made of — a
    /// Session that started running, a Permission that expired — and a value the deck diffs must
    /// compare unequal only when what it draws has changed.
    static func == (lhs: FeedAgentReadings, rhs: FeedAgentReadings) -> Bool {
        lhs.events == rhs.events
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

    /// The same question asked with the Session's rows alone, which is the only thing two of the
    /// three callers have: the deck's zones read it per layout pass, and the shell reads it to
    /// resolve what the toolbar's evidence toggle opens on (#875). One decision, spelled once.
    @MainActor func reading(of feed: [FeedRow], under scope: FeedScope) -> [FeedRow] {
        guard let stamp else { return derived(of: feed, under: scope) }
        return SessionsRoomReadingCache.scoped(at: stamp, under: scope) {
            derived(of: feed, under: scope)
        }
    }

    @MainActor private func derived(of feed: [FeedRow], under scope: FeedScope) -> [FeedRow] {
        rows(under: scope, of: agents(in: feed), otherwise: feed)
    }

    /// Who else is working, off the Session's own rows. Here rather than at `FeedAgents` so the
    /// rail, the deck's zoning and the scope above share ONE walk of the reading.
    ///
    /// `feed` is walked only where the reading is unstamped — a specimen, a `#Preview`, a suite. A
    /// stamped one answers with the list the cache derived from its OWN rows, which is what keeps
    /// the answer a fact about the reading rather than about whoever asked first.
    @MainActor func agents(in feed: [FeedRow]) -> [FeedAgent] {
        guard let stamp, let known = SessionsRoomReadingCache.agents(at: stamp) else {
            return FeedAgents.all(in: feed)
        }
        return known
    }
}
