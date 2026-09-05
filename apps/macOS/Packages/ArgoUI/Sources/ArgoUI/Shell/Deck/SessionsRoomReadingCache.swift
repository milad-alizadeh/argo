import ArgoEngine

/// What the shell remembers about a reading it has already taken, so coming BACK to a Session costs
/// a lookup rather than another walk of its whole event stream (ADR-0028 Rule 1).
///
/// `CockpitView.body` re-runs on any of its own state changes and on every presentation the Hub
/// publishes, and each pass took the whole projection again — a click on a roster row and a click
/// back onto the row before it cost two identical walks of two whole transcripts.
///
/// Held oldest-first and evicted from the front, bounded by the same two ceilings the readings
/// themselves are (`ReadingCeilings`): a reader moving between two Sessions touches both on every
/// pass, and a reading holds roughly one row per event.
///
/// Keyed by a STAMP rather than by a Session, because a remembered reading must never draw a
/// transcript as it stood when the reader last looked at it.
///
/// It is the stream's OWN stamp and not its length, because a Session's stream is no longer
/// append-only: a Turn put twice takes the abandoned branch back out of it (#1202), and a fork
/// drops exactly what it re-adds — the abandoned record's three events for the superseding
/// record's three — so a length would name two different streams with one number and the deck
/// would keep drawing the branch that was removed. `TranscriptStamp` counts WRITES beside the
/// length for this reason, so any write at all moves it, appending or not.
@MainActor
enum SessionsRoomReadingCache {
    /// The version of a Session's record a reading was taken at.
    ///
    /// Everything `FeedProjection` and `PlanProjection` read is here: the stream by its STAMP, and
    /// the six small facts by VALUE, since none of them is append-only. The header is deliberately
    /// absent — see `SessionsRoomReading.init`.
    ///
    /// A Subagent's reading is absent too, and that is #858 rather than an omission: a child's
    /// bytes are in none of the three derivations below, so a stamp that moved for them would take
    /// the whole reading again for a lane that is not even on screen. What the SCOPED rows depend
    /// on is carried beside this — see `Scoping`.
    struct Stamp: Equatable, Sendable {
        let sessionID: String?
        /// Which version of the stream the reading was taken at. Moved by every write the engine
        /// makes, drops included — see the note above on why a length is not enough.
        let stream: TranscriptStamp
        let asking: FeedAskProjection.Asking
        let handedOff: FeedHandoff?
        let expired: [PermissionExpiry]
        /// The question the agent reported over the companion plugin (#1205), by VALUE like the
        /// facts around it: it is a claim about NOW rather than something appended to the stream,
        /// so a stamp that stopped at the events would go on drawing an answered question.
        let reported: Ask?
        /// The Session's own status, stored as the STATUS rather than as either reading taken of
        /// it: the feed's live row wants a Turn in progress (`FeedWorking`) and the rail's dots
        /// want a Session that can still be driving work (`DelegatingSession`, #1076), and those
        /// two boundaries are no longer the same. One fact here, each reading named where it is
        /// taken — two stored Bools would be two places to answer a status added later.
        let status: SessionStatus?
        /// Whether the wait for the Session's first byte ran out with its process still up
        /// (#1245). By VALUE beside the status, and not read OFF it: the row it draws stands over
        /// a Session whose status has already fallen through to what the world readings say, so a
        /// stamp stopping at the status would go on drawing `starting the agent` at a wait that
        /// has ended.
        let startedQuietly: Bool
        /// The waits Argo held that have ended (#1323), by VALUE for the reason the flag above is:
        /// each one appends a row to the reading and none of them is in the stream, so a stamp
        /// stopping at the events would keep drawing the reading as it stood before the wait
        /// settled.
        let settledWaits: [SessionWaitSettled]
        /// The Turn Argo itself submitted that no record has answered (#1179, #1278, #1323) —
        /// the DIRECT gate the plinth's `.thinking` wait stands behind, and the row the feed draws
        /// for it. By VALUE beside the status, and not read off it: two Sessions can both read
        /// `running` while only one of them is a Turn Argo itself typed. The WORDS rather than a
        /// flag, because the reading draws them: a stamp that stopped at "there is one" would go
        /// on drawing the first sentence after a second Turn replaced it.
        let submittedTurn: String?

        /// Whether there IS such a Turn — derived here rather than compared at each reader, so the
        /// sentinel is spelled once (`rules/house.md`, one source of truth).
        var hasUnansweredTurn: Bool {
            submittedTurn != nil
        }

        /// Whether the `starting` status this stamp carries is a resume rather than a fresh spawn
        /// (#1328), by VALUE beside `startedQuietly` for the same reason: the plinth reads off this
        /// stamp rather than off the Session directly.
        let resuming: Bool
        /// Whether Argo is running `/handoff` on this Session right now (#1327), by VALUE beside
        /// `resuming` for the same reason: the plinth reads off this stamp, and it is a claim about
        /// NOW rather than something appended to the stream.
        let handingOff: Bool
        /// The handoffs Argo attempted here that did NOT land (#1327), by VALUE beside
        /// `settledWaits` for the reason that one is: each appends a row to the reading and none of
        /// them is in the stream.
        let handoffFailures: [SessionWaitSettled]
        /// What a backgrounded delegation is holding open, and which of those the reader has ended
        /// (#1267) — see `DelegationHold`. By VALUE beside the status for the reason
        /// `hasUnansweredTurn` above is, and one of its own: ending a delegation appends nothing to
        /// the stream, so a stamp stopping at the events would go on drawing the chip running.
        let delegationHold: DelegationHold

        /// Derived from the Session rather than spelled out at the call site: a stamp assembled by
        /// hand is one a later projection input can quietly fall out of.
        init(
            of session: CockpitPresentation.Session?,
            asking: FeedAskProjection.Asking,
            handedOff: FeedHandoff?,
        ) {
            self.sessionID = session?.id
            self.stream = session?.transcript.stream.stamp ?? TranscriptStamp()
            self.asking = asking
            self.handedOff = handedOff
            self.expired = session?.expiredPermissions ?? []
            self.reported = session?.companionAsk?.ask
            self.status = session?.status
            self.startedQuietly = session?.startedQuietlyAtMs != nil
            self.settledWaits = session?.settledWaits ?? []
            self.submittedTurn = session?.submittedTurn
            self.resuming = session?.resuming ?? false
            self.handingOff = session?.handingOff ?? false
            self.handoffFailures = session?.handoffFailures ?? []
            self.delegationHold = session?.delegationHold ?? .none
        }
    }

    /// The three things a reading walks the streams for. The rest of `SessionsRoomReading` is
    /// cheap and stays uncached.
    struct Body {
        let feed: [FeedRow]
        /// The wait Argo is holding on this reading, if any — see `SessionsRoomReading.wait`. Here
        /// rather than taken fresh each pass because it is read off the same stamp the rows are:
        /// two answers to one question is how a plinth and a reading come to disagree.
        let wait: FeedWait?
        let showing: PlanShowing
        /// The header's one event-stream walk — see `SessionHeaderProjection.header(from:worked:)`.
        /// The rest of the header is not here, and must not be: spend and context move with no
        /// event appended, so a remembered header would go stale where a remembered feed cannot.
        let worked: SessionHeaderProjection.Worked
    }

    #if DEBUG
        /// What the cache did not save, counted rather than inferred (ADR-0028 Rule 7). DEBUG-only,
        /// the way `FeedPaneCost` is: nothing outside a suite reads it.
        static var cost = SessionsRoomReadingCost()
    #endif

    /// What the rows a scope draws are a function of, beyond the stamp: which Agent the feed is
    /// scoped onto, and how much of that Agent Argo had read. The second half is why this is a
    /// value rather than the scope alone — the stamp above stops at the Session's own stream, so a
    /// growing Subagent moves nothing else here (#858).
    struct Scoping: Hashable {
        let scope: FeedScope
        /// How many events the scoped Agent's reading held. `nil` for the Session's own rows, and
        /// for a scope naming an Agent nothing has read.
        let read: Int?
    }

    /// What has been derived off one entry's reading and remembered — everything a second asker at
    /// the same stamp gets for free. One value rather than three fields beside the body, because
    /// they are one thing: the answers this entry has already paid for.
    private struct Derived {
        var agents: [FeedAgent]?
        var scoped: [Scoping: [FeedRow]] = [:]
        /// One measure per Subagent, and the reading each was taken at beside it. Per SUBAGENT
        /// rather than per version of its file: a child writing under a parent that is not would
        /// otherwise leave one entry per version here, and the room's stamp — which is what evicts
        /// anything — does not move for a child's bytes.
        var measures: [String: SubagentMeasure] = [:]
        var measuredAt: [String: Measuring] = [:]
    }

    private struct Entry {
        let stamp: Stamp
        let body: Body
        var derived = Derived()
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
        evictOldest()
        return body
    }

    /// Who else is working — the walk `DeckContentRow` and the deck's zoning both need, taken once
    /// for the pass. `nil` where nothing is held at this stamp, which leaves the caller to walk.
    ///
    /// Derived from the ENTRY's own rows and its own stamp, never from anything a caller passed
    /// in. The list is a fact about the reading — including whether the Session behind it is
    /// running, which is what says a still-open delegation is a Subagent still working (#1076) —
    /// and a memo keyed on the stamp that forwarded the caller's rows would let the first caller's
    /// answer stand for every later one.
    static func agents(at stamp: Stamp) -> [FeedAgent]? {
        guard let found = index(of: stamp) else { return nil }
        let at = entries.touch(found)
        if let agents = entries[at].derived.agents {
            return agents
        }
        let agents = FeedAgents.all(
            in: entries[at].body.feed,
            of: DelegatingSession.of(entries[at].stamp.status),
        )
        counted(\.agents)
        entries[at].derived.agents = agents
        return agents
    }

    /// The rows a scope actually draws. Memoised per `Scoping` because the second reader of them
    /// is the toolbar, a whole view tree away from the deck that drew them (#875) — and because a
    /// Subagent that has written since is a different question with the same scope.
    static func scoped(
        at stamp: Stamp,
        drawing scoping: Scoping,
        otherwise derive: () -> [FeedRow],
    )
        -> [FeedRow] {
        guard let found = index(of: stamp) else { return derive() }
        let at = entries.touch(found)
        if let rows = entries[at].derived.scoped[scoping] {
            return rows
        }
        let rows = derive()
        counted(\.scopes)
        entries[at].derived.scoped[scoping] = rows
        return rows
    }

    /// What one chip's own file measures (#1279), memoised for the reason the scoped rows are: the
    /// Every chip's measure (#1279), memoised for the reason the scoped rows are: the rail asks on
    /// every pass, and the walk behind one answer is the child's whole file. Keyed by that child's
    /// own growth stamp beside the room's, so a Subagent Argo has watched write since is measured
    /// again and one it has not costs a dictionary lookup.
    ///
    /// The WHOLE list in one call, and that is the point: found per chip, this cost a search of the
    /// entries for a matching `Stamp` plus an LRU move, on every chip on every pass — the room
    /// looked up once per Agent instead of once per pass, which is #858's cost with a different
    /// number on it. One lookup here, however many chips are in the rail.
    ///
    /// Derives without remembering where nothing holds this stamp — a specimen, a `#Preview`, a
    /// suite — exactly as `scoped(at:drawing:otherwise:)` does.
    static func measures(
        at stamp: Stamp,
        of watched: [Measuring],
        otherwise derive: (Measuring) -> SubagentMeasure,
    )
        -> [String: SubagentMeasure] {
        guard let found = index(of: stamp) else {
            return watched.reduce(into: [:]) { $0[$1.subagentID] = derive($1) }
        }
        let at = entries.touch(found)
        for measuring in watched where entries[at].derived.measuredAt[measuring.subagentID]
            != measuring {
            entries[at].derived.measuredAt[measuring.subagentID] = measuring
            entries[at].derived.measures[measuring.subagentID] = derive(measuring)
            counted(\.measures)
        }
        // The held dictionary itself, never a copy of the part that was asked for: this is the warm
        // pass, and a dictionary built per pass out of answers that were all already here is the
        // cost this memo exists to avoid, one allocation smaller.
        return entries[at].derived.measures
    }

    /// Everything remembered, dropped. For a suite that needs a cold cache; nothing in the app
    /// calls it, because a stamp that has moved already evicts what it replaces.
    static func forget() {
        entries.removeAll()
        #if DEBUG
            cost = SessionsRoomReadingCost()
        #endif
    }

    /// Oldest first, one at a time, until both ceilings hold — never `removeAll` (ADR-0028 Rule 4).
    /// The reading just taken is never evicted: dropping it would derive it again on the next pass.
    private static func evictOldest() {
        while entries.count > ReadingCeilings.readings
            || rowsHeld() > ReadingCeilings.events, entries.count > 1 {
            entries.removeFirst()
        }
    }

    private static func rowsHeld() -> Int {
        entries.reduce(0) { $0 + $1.body.feed.count }
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
    var measures = 0
}

private extension Array {
    /// Moves the element at `index` to the back — the LRU order — and says where it went.
    mutating func touch(_ index: Int) -> Int {
        append(remove(at: index))
        return count - 1
    }
}
