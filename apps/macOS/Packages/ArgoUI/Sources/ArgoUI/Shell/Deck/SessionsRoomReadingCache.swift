import ArgoEngine

/// What the shell remembers about a reading it has already taken, so coming BACK to a Session costs
/// a lookup rather than another walk of its whole event stream (ADR-0028 Rule 1).
///
/// `CockpitView.body` re-runs on any of its own state changes and on every presentation the Hub
/// publishes, and each pass took the whole projection again — a click on a roster row and a click
/// back onto the row before it cost two identical walks of two whole transcripts.
///
/// Keyed by a STAMP rather than by a Session, because a remembered reading must never draw a
/// transcript as it stood when the reader last looked at it. The stamp is sound because the streams
/// are append-only within a Session — `HubSession.apply` only ever appends, and a resume merges by
/// `+=` — so a count names a prefix and a count that has not moved names the same prefix.
@MainActor
enum SessionsRoomReadingCache {
    /// The version of a Session's record a reading was taken at.
    ///
    /// Everything `FeedProjection`, `PlanProjection` and `FeedAgentReadings` read is here: the two
    /// streams by length, and the four small facts by VALUE, since none of them is append-only.
    /// The header is deliberately absent — see `SessionsRoomReading.init`.
    struct Stamp: Equatable, Sendable {
        let sessionID: String?
        let events: Int
        let subagentEvents: [String: Int]
        let asking: FeedAskProjection.Asking
        let handedOff: FeedHandoff?
        let expired: [PermissionExpiry]
        let isWorking: Bool

        /// Derived from the Session rather than spelled out at the call site: a stamp assembled by
        /// hand is one a later projection input can quietly fall out of.
        init(
            of session: CockpitPresentation.Session?,
            asking: FeedAskProjection.Asking,
            handedOff: FeedHandoff?,
        ) {
            self.sessionID = session?.id
            self.events = session?.events.count ?? 0
            self.subagentEvents = (session?.subagentEvents ?? [:]).mapValues(\.count)
            self.asking = asking
            self.handedOff = handedOff
            self.expired = session?.expiredPermissions ?? []
            self.isWorking = FeedWorking.isWorking(session)
        }
    }

    /// The three things a reading walks the streams for. The rest of `SessionsRoomReading` is
    /// cheap and stays uncached.
    struct Body {
        let feed: [FeedRow]
        let showing: PlanShowing
        let readings: FeedAgentReadings
        /// The header's one event-stream walk — see `SessionHeaderProjection.header(from:worked:)`.
        /// The rest of the header is not here, and must not be: spend and context move with no
        /// event appended, so a remembered header would go stale where a remembered feed cannot.
        let worked: SessionHeaderProjection.Worked
    }

    /// Four, so browsing between a handful of Sessions is free. Held oldest-first and evicted from
    /// the front — a reader moving between two Sessions touches both on every pass.
    static let capacity = 4

    #if DEBUG
        /// What the cache did not save, counted rather than inferred (ADR-0028 Rule 7). DEBUG-only,
        /// the way `FeedPaneCost` is: nothing outside a suite reads it.
        static var cost = SessionsRoomReadingCost()
    #endif

    private struct Entry {
        let stamp: Stamp
        let body: Body
        var agents: [FeedAgent]?
        var scoped: [FeedScope: [FeedRow]] = [:]
    }

    private static var entries: [Entry] = []

    /// The reading at this stamp, taken only where nothing has one.
    static func body(at stamp: Stamp, otherwise derive: () -> Body) -> Body {
        if let found = index(of: stamp) {
            let at = entries.touch(found)
            return entries[at].body
        }
        let body = derive()
        counted(\.bodies)
        entries.removeAll { $0.stamp.sessionID == stamp.sessionID }
        entries.append(Entry(stamp: stamp, body: body))
        if entries.count > capacity {
            entries.removeFirst(entries.count - capacity)
        }
        return body
    }

    /// Who else is working — the walk `DeckContentRow` and the deck's zoning both need, taken once
    /// for the pass. `nil` where nothing is held at this stamp, which leaves the caller to walk.
    ///
    /// Derived from the ENTRY's own rows and never from rows a caller passed in. The list is a fact
    /// about the reading, and a memo keyed on the stamp that forwarded the caller's rows would let
    /// the first caller's answer stand for every later one — a rail answered with no agents drops
    /// the feed's scope on the floor, because `FeedAgentReadings.rows(under:of:otherwise:)` falls
    /// back the moment nothing in the list is running.
    static func agents(at stamp: Stamp) -> [FeedAgent]? {
        guard let found = index(of: stamp) else { return nil }
        let at = entries.touch(found)
        if let agents = entries[at].agents {
            return agents
        }
        let agents = FeedAgents.all(in: entries[at].body.feed)
        counted(\.agents)
        entries[at].agents = agents
        return agents
    }

    /// The rows a scope actually draws. Memoised per scope because the second reader of it is the
    /// toolbar, a whole view tree away from the deck that drew them (#875).
    static func scoped(
        at stamp: Stamp,
        under scope: FeedScope,
        otherwise derive: () -> [FeedRow],
    )
        -> [FeedRow] {
        guard let found = index(of: stamp) else { return derive() }
        let at = entries.touch(found)
        if let rows = entries[at].scoped[scope] {
            return rows
        }
        let rows = derive()
        counted(\.scopes)
        entries[at].scoped[scope] = rows
        return rows
    }

    /// Everything remembered, dropped. For a suite that needs a cold cache; nothing in the app
    /// calls it, because a stamp that has moved already evicts what it replaces.
    static func forget() {
        entries.removeAll()
        #if DEBUG
            cost = SessionsRoomReadingCost()
        #endif
    }

    private static func index(of stamp: Stamp) -> Int? {
        entries.firstIndex { $0.stamp == stamp }
    }

    private static func counted(_ derivation: WritableKeyPath<SessionsRoomReadingCost, Int>) {
        #if DEBUG
            cost[keyPath: derivation] += 1
        #endif
    }
}

/// How many derivations the cache did NOT save, per kind. Zero on a repeat pass is the claim.
struct SessionsRoomReadingCost {
    var bodies = 0
    var agents = 0
    var scopes = 0
}

private extension Array {
    /// Moves the element at `index` to the back — the LRU order — and says where it went.
    mutating func touch(_ index: Int) -> Int {
        append(remove(at: index))
        return count - 1
    }
}
