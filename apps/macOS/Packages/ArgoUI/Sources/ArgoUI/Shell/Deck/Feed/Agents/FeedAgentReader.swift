import ArgoEngine

/// Where the deck gets a Subagent's reading from — a reader, not the readings themselves (#858).
///
/// The files behind them grow the whole time an agent works, and while their events travelled
/// inside the cockpit projection every batch invalidated the scene root and every roster row —
/// bytes only a Subagent lane can draw. Asked for through this instead, a batch reaches the
/// surfaces that asked at all: the rail, which needs to know a chip HAS a reading, and the feed
/// while it is scoped onto one. Not finer than that — the engine holds them under one observed
/// property — and the point was never the lane, it was the root.
///
/// Still a value the deck is handed rather than a store a view reaches for: what it closes over is
/// the engine's answer, the way `CockpitActions`' verbs close over the Hub. Reading nothing is the
/// honest default AND the ordinary case — most Sessions delegate nothing, and Codex writes no such
/// record at all.
///
/// Two readers are the same reader when they ask the same source at the same stamp, which is what
/// `identity` is for: a closure cannot be compared, and without this every view holding one would
/// fail SwiftUI's comparison on every pass — the cost this ticket is about, reintroduced one level
/// down. Equal means "asks the same thing", never "would answer the same": what the source SAYS
/// changes constantly, and telling the views about that is Observation's job, not this value's.
public struct FeedAgentReader: Equatable, Sendable {
    private let identity: Identity
    private let read: @MainActor @Sendable (String) -> [TranscriptEvent]?
    /// Which version of the Session's record this reader was handed down at, and `nil` for one
    /// nobody stamped — a specimen, a `#Preview`, a suite. The two derivations below are memoised
    /// under it so the deck's zones and the toolbar's evidence toggle ask the same question once
    /// (#875, #1005). Unstamped simply derives, which is what it did before.
    private let stamp: SessionsRoomReadingCache.Stamp?
    /// Whether the Session these delegations belong to is itself running (`DelegatingSession`).
    /// Read off the stamp below, so the cache's memo and the walk this file does cannot disagree.
    private let liveness: DelegatingSession

    /// A reader that has nothing to ask.
    public static let unread = FeedAgentReader()

    /// The shipping reader: `source` is the object the closure asks, and two readers on one source
    /// are the same reader however many times the shell rebuilds the closure.
    public init(
        asking source: AnyObject,
        read: @escaping @MainActor @Sendable (String) -> [TranscriptEvent]?,
    ) {
        self.identity = .source(ObjectIdentifier(source))
        self.read = read
        self.stamp = nil
        self.liveness = .notRunning
    }

    /// The readings a fixture or a specimen has in hand, which are a dictionary and never a live
    /// file — so a state rendered for review is the state that ships.
    init(events: [String: [TranscriptEvent]], of session: DelegatingSession = .notRunning) {
        self.identity = .fixture(events)
        self.read = { events[$0] }
        self.stamp = nil
        self.liveness = session
    }

    private init() {
        self.identity = .nothing
        self.read = { _ in nil }
        self.stamp = nil
        self.liveness = .notRunning
    }

    private init(_ other: FeedAgentReader, stamp: SessionsRoomReadingCache.Stamp?) {
        self.identity = other.identity
        self.read = other.read
        self.stamp = stamp
        self.liveness = DelegatingSession.of(stamp?.status)
    }

    /// The same reader, told which reading of the Session it is being asked alongside. Taken by
    /// `SessionsRoomReading`, which is the one place that knows the stamp — and the stamp is where
    /// the Session's own status arrives, so the rail needs nothing else handed down the deck.
    func stamped(_ stamp: SessionsRoomReadingCache.Stamp?) -> FeedAgentReader {
        FeedAgentReader(self, stamp: stamp)
    }

    public static func == (first: FeedAgentReader, second: FeedAgentReader) -> Bool {
        first.identity == second.identity && first.stamp == second.stamp
            && first.liveness == second.liveness
    }

    /// Whether Argo has read this Agent's file at all. Asked by the rail per chip, which is why it
    /// is not `rows(of:) != nil`: that projected the child's whole file to throw it away.
    @MainActor func hasReading(of agent: FeedAgent) -> Bool {
        guard let id = agent.subagentID else { return false }
        return read(id) != nil
    }

    /// One Subagent's rows, or `nil` where Argo does not have its record.
    ///
    /// `nil` rather than an empty reading, and the two are different claims: no rows would say the
    /// Agent did nothing, where this says nobody has read it. It is what makes a chip selectable —
    /// degrade-down, so a chip Argo cannot scope onto is navigation that stays quiet rather than a
    /// control that empties the feed.
    @MainActor func rows(of agent: FeedAgent) -> [FeedRow]? {
        guard let id = agent.subagentID, let read = read(id) else { return nil }
        return FeedProjection.rows(from: read)
    }

    /// What the deck's one feed draws under a scope: the Subagent's rows, or the Session's.
    ///
    /// A scope is honoured only while the rail is still LISTING — the rail is the only way back out
    /// of a Subagent, so a scope that outlived it would strand the reader in a feed with no chip to
    /// click. LISTING and never RUNNING: the rail stays for every Session that delegated anything
    /// (`DeckZoning.showsRail`), so keyed on the running dots this would drop a chip's own reading
    /// on the floor the moment they went honest (#1076). It falls back for an Agent that has left
    /// the list too, and for one whose reading has gone — both live-transcript cases, since a chip
    /// is only offered where there was a reading to offer.
    ///
    /// Nothing is asked of the engine until a scope names an Agent, which is what keeps a reader
    /// who has scoped nothing out of the way of a child's bytes entirely.
    @MainActor func rows(under scope: FeedScope, of agents: [FeedAgent], otherwise feed: [FeedRow])
        -> [FeedRow] {
        guard !agents.isEmpty,
              let selected = scope.agent,
              let agent = agents.first(where: { $0.id == selected }),
              let rows = rows(of: agent) else { return feed }
        return rows
    }

    /// The same question asked with the Session's rows alone, which is the only thing two of the
    /// three callers have: the deck's zones read it per layout pass, and the shell reads it to
    /// resolve what the toolbar's evidence toggle opens on (#875). One decision, spelled once.
    ///
    /// Memoised under the room's stamp AND the scoped Agent's own length, because the room's stamp
    /// no longer moves for a child's bytes — that is the whole of #858 — so a memo keyed on it
    /// alone would freeze a scoped feed while the Agent it is scoped onto went on writing.
    @MainActor func reading(of feed: [FeedRow], under scope: FeedScope) -> [FeedRow] {
        guard let stamp else { return derived(of: feed, under: scope) }
        return SessionsRoomReadingCache.scoped(at: stamp, drawing: scoping(under: feed, scope)) {
            derived(of: feed, under: scope)
        }
    }

    /// Who else is working, off the Session's own rows. Here rather than at `FeedAgents` so the
    /// rail, the deck's zoning and the scope above share ONE walk of the reading.
    ///
    /// `feed` is walked only where the reader is unstamped — a specimen, a `#Preview`, a suite. A
    /// stamped one answers with the list the cache derived from its OWN rows, which is what keeps
    /// the answer a fact about the reading rather than about whoever asked first.
    @MainActor func agents(in feed: [FeedRow]) -> [FeedAgent] {
        guard let stamp, let known = SessionsRoomReadingCache.agents(at: stamp) else {
            return FeedAgents.all(in: feed, of: liveness)
        }
        return known
    }

    @MainActor private func derived(of feed: [FeedRow], under scope: FeedScope) -> [FeedRow] {
        rows(under: scope, of: agents(in: feed), otherwise: feed)
    }

    /// What the scoped rows are a function of beyond the room's stamp: which Agent, and how much of
    /// it Argo had read when they were derived.
    @MainActor private func scoping(
        under feed: [FeedRow],
        _ scope: FeedScope,
    )
        -> SessionsRoomReadingCache.Scoping {
        guard let selected = scope.agent,
              let agent = agents(in: feed).first(where: { $0.id == selected }),
              let id = agent.subagentID
        else { return SessionsRoomReadingCache.Scoping(scope: scope, read: nil) }
        return SessionsRoomReadingCache.Scoping(scope: scope, read: read(id)?.count)
    }

    /// What makes two readers the same one. The fixture carries its readings because that is all it
    /// is; the live one carries the object it asks, never the answer.
    private enum Identity: Equatable, Sendable {
        case nothing
        case source(ObjectIdentifier)
        case fixture([String: [TranscriptEvent]])
    }
}
