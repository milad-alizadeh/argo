import ArgoEngine
import Foundation

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
    /// When Argo last watched one Subagent's own file GROW, per id — `Hub.subagentGrewAtMs(of:)`.
    /// Beside `read` rather than folded into it: the rail asks this per chip on every pass, and
    /// projecting a child's whole file to date it is the cost `hasReading(of:)` exists to avoid.
    private let grewAtMs: @MainActor @Sendable (String) -> Int?
    /// Which version of the Session's record this reader was handed down at, and `nil` for one
    /// nobody stamped — a specimen, a `#Preview`, a suite. The two derivations below are memoised
    /// under it so the deck's zones and the toolbar's evidence toggle ask the same question once
    /// (#875, #1005). Unstamped simply derives, which is what it did before.
    private let stamp: SessionsRoomReadingCache.Stamp?
    /// Whether the Session these delegations belong to is itself running (`DelegatingSession`).
    /// Read off the stamp below, so the cache's memo and the walk this file does cannot disagree.
    private let liveness: DelegatingSession
    /// What a backgrounded delegation is holding open here, and which of them the reader has ENDED
    /// (#1267). Read off the stamp beside `liveness`, for the same reason: one fact, taken where
    /// the Session is in hand, so the memo and this file's walk cannot disagree about it.
    private let hold: DelegationHold

    /// A reader that has nothing to ask.
    public static let unread = FeedAgentReader()

    /// The shipping reader: `source` is the object the closure asks, and two readers on one source
    /// are the same reader however many times the shell rebuilds the closure.
    ///
    /// Both closures are required. A defaulted `grewAtMs` would be a shipping reader that quietly
    /// answers "nothing is writing" — the reading this ticket exists to have stopped being the
    /// default (#1269).
    public init(
        asking source: AnyObject,
        read: @escaping @MainActor @Sendable (String) -> [TranscriptEvent]?,
        grewAtMs: @escaping @MainActor @Sendable (String) -> Int?,
    ) {
        self.identity = .source(ObjectIdentifier(source))
        self.read = read
        self.grewAtMs = grewAtMs
        self.stamp = nil
        self.liveness = .notRunning
        self.hold = .none
    }

    /// The readings a fixture or a specimen has in hand, which are a dictionary and never a live
    /// file — so a state rendered for review is the state that ships.
    ///
    /// `writing` names the Subagents whose files are growing as the state is drawn. A set rather
    /// than a date, because what a fixture is stating is the CLAIM — this child is writing — and a
    /// moment it had to pick relative to a clock is a moment that ages.
    ///
    /// `ended` names the delegations the reader has ended, by CALL id (#1267) — the other set the
    /// rail's dots are read from, and the reason a specimen can draw the state a lost report leaves
    /// without a Hub behind it. It states nothing about what is holding the Turn open: that is a
    /// reading of the Session's own stream, and a fixture's chips are handed over already made.
    package init(
        events: [String: [TranscriptEvent]],
        of session: DelegatingSession = .notRunning,
        writing: Set<String> = [],
        ended: Set<String> = [],
    ) {
        self.identity = .fixture(events, writing: writing)
        self.read = { events[$0] }
        self.grewAtMs = { writing.contains($0) ? Date().epochMs : nil }
        self.stamp = nil
        self.liveness = session
        self.hold = DelegationHold(backgrounded: [], isAlone: false, ended: ended)
    }

    private init() {
        self.identity = .nothing
        self.read = { _ in nil }
        self.grewAtMs = { _ in nil }
        self.stamp = nil
        self.liveness = .notRunning
        self.hold = .none
    }

    private init(_ other: FeedAgentReader, stamp: SessionsRoomReadingCache.Stamp?) {
        self.identity = other.identity
        self.read = other.read
        self.grewAtMs = other.grewAtMs
        self.stamp = stamp
        self.liveness = DelegatingSession.of(stamp?.status)
        self.hold = stamp?.delegationHold ?? .none
    }

    /// The same reader, told which reading of the Session it is being asked alongside. Taken by
    /// `SessionsRoomReading`, which is the one place that knows the stamp — and the stamp is where
    /// the Session's own status arrives, so the rail needs nothing else handed down the deck.
    func stamped(_ stamp: SessionsRoomReadingCache.Stamp?) -> FeedAgentReader {
        FeedAgentReader(self, stamp: stamp)
    }

    public static func == (first: FeedAgentReader, second: FeedAgentReader) -> Bool {
        first.identity == second.identity && first.stamp == second.stamp
            && first.liveness == second.liveness && first.hold == second.hold
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
        let walked = stamp.flatMap { SessionsRoomReadingCache.agents(at: $0) }
            ?? FeedAgents.all(in: feed, of: liveness)
        return told(walked)
    }

    /// What the walk above cannot answer, answered off the children's own files (#1269).
    ///
    /// OUTSIDE the memo on purpose: the room's stamp does not move for a child's bytes (#858), so a
    /// growth reading held inside it would freeze at whatever the child was doing when its parent
    /// last wrote — the same staleness the rail was reported for, one level down. This is a
    /// dictionary lookup per chip, so it is taken every pass.
    ///
    /// `nowMs` is read here rather than threaded: this is the one place the deck asks, and both
    /// datings below want the same moment.
    @MainActor private func told(_ agents: [FeedAgent]) -> [FeedAgent] {
        let nowMs = Date().epochMs
        return FeedAgents.told(
            agents,
            writing: { SubagentWriting.read(lastGrewAtMs: grewAtMs($0), nowMs: nowMs) },
            ended: hold,
            at: nowMs,
        )
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
        /// The writing set rides along because two fixtures with the same events and different
        /// children writing are two different states, and a `#Preview` that swapped one for the
        /// other would otherwise fail SwiftUI's comparison and never redraw.
        case fixture([String: [TranscriptEvent]], writing: Set<String>)
    }
}
