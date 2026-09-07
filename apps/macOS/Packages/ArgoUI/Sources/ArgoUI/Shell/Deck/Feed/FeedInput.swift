import ArgoEngine

/// Everything `FeedProjection.rows` reads, in one value.
///
/// One value rather than ten parameters, and NO defaults anywhere in it or in the values below
/// (#1504): a projection input that could be left out is one a call site goes on omitting after
/// the input starts mattering, and the feed it draws is stale with nothing to say so. Spelled
/// here, an input added later fails the build at every place that has to answer for it.
/// `FeedShapeHeight.tickets` refuses a default on the same ground.
package struct FeedInput {
    /// The record's own stream, in the record's own order.
    package let events: [TranscriptEvent]
    /// Everything that is not the record's — see `FeedBeside`.
    package let beside: FeedBeside

    package init(events: [TranscriptEvent], beside: FeedBeside) {
        self.events = events
        self.beside = beside
    }

    /// A reading of the stream and nothing else, for the readers where that is the truth rather
    /// than a shortcut: a Subagent's own file (`FeedAgentReader`), a census of a transcript on
    /// disk (`FeedRowCensus`), and the suites that assert on what the record itself draws.
    ///
    /// The one place the quiet value is spelled, so an input added later is answered once here
    /// rather than defaulted invisibly at every call.
    package static func justTheStream(_ events: [TranscriptEvent]) -> FeedInput {
        FeedInput(events: events, beside: .nothing)
    }
}

/// The projection's inputs that are NOT the record's. No CLI wrote a word about any of them, so
/// they arrive beside the stream rather than being looked for inside it.
///
/// Four readings rather than nine fields, because the initializer cap is four and the way past it
/// is the grouping, never a wider number (`apps/macOS/.swiftlint.yml`, edge 6): each value below
/// is one thing Argo knows about the Session that the transcript does not.
///
/// This is also the memo key's list (`SessionsRoomReadingCache.Stamp`), which is why it is
/// `Equatable`: every fact here is held BY VALUE there because none of them is append-only, so a
/// stamp that stopped at the stream would go on drawing a reading whose beside facts have moved.
/// One list, in one place — the key and the projection can no longer disagree about what it holds.
package struct FeedBeside: Equatable, Sendable {
    /// The Turn Argo is driving right now.
    package let turn: FeedTurnDriven
    /// The waits Argo held on this Session and how they ended.
    package let waits: FeedWaitsHeld
    /// Where the work went when Argo handed it on.
    package let handoffs: FeedHandoffs
    /// What Argo's own gate and the companion plugin are holding.
    package let gate: FeedGateHolds

    /// Nothing beside the stream: the reading a record alone produces. Spelled once, here, so a
    /// field added to any of the four values above is answered in one place.
    package static let nothing = FeedBeside(
        turn: .nothing,
        waits: .nothing,
        handoffs: .nothing,
        gate: .nothing,
    )

    /// One reading beside the stream and the other three quiet — the shape most call sites want,
    /// since a test or a specimen is usually saying one thing Argo knows that the record does not.
    ///
    /// Four overloads rather than four defaults: what is being supplied is named by its type, the
    /// three that are not are `.nothing` in ONE place, and a fifth reading added to `FeedBeside`
    /// later fails the build here rather than being quietly defaulted at every call.
    package static func just(_ turn: FeedTurnDriven) -> FeedBeside {
        FeedBeside(turn: turn, waits: .nothing, handoffs: .nothing, gate: .nothing)
    }

    package static func just(_ waits: FeedWaitsHeld) -> FeedBeside {
        FeedBeside(turn: .nothing, waits: waits, handoffs: .nothing, gate: .nothing)
    }

    package static func just(_ handoffs: FeedHandoffs) -> FeedBeside {
        FeedBeside(turn: .nothing, waits: .nothing, handoffs: handoffs, gate: .nothing)
    }

    package static func just(_ gate: FeedGateHolds) -> FeedBeside {
        FeedBeside(turn: .nothing, waits: .nothing, handoffs: .nothing, gate: gate)
    }

    package init(
        turn: FeedTurnDriven,
        waits: FeedWaitsHeld,
        handoffs: FeedHandoffs,
        gate: FeedGateHolds,
    ) {
        self.turn = turn
        self.waits = waits
        self.handoffs = handoffs
        self.gate = gate
    }
}

/// The Turn now in flight, as Argo knows it rather than as the record does.
package struct FeedTurnDriven: Equatable, Sendable {
    /// Whether a Turn is in flight (`FeedWorking`), which is a reading of the Session's status
    /// rather than the status itself: the rail's dots want a different boundary off the same fact
    /// (`DelegatingSession`, #1076), so each reading is named where it is taken.
    package let working: Bool
    /// The Turn Argo itself typed that no record has answered (#1179, #1278, #1323). The WORDS
    /// rather than a flag, because the reading draws them.
    package let submitted: String?

    /// No Turn of Argo's in flight here.
    package static let nothing = FeedTurnDriven(working: false, submitted: nil)

    /// A Turn in flight with nothing of Argo's own typed under it — the state the thread is drawn
    /// for, and the one nearly every reading of a live Session is taken in. Named beside `nothing`
    /// so a field added here is answered in the same place the quiet value is.
    package static let inFlight = FeedTurnDriven(working: true, submitted: nil)

    package init(working: Bool, submitted: String?) {
        self.working = working
        self.submitted = submitted
    }
}

/// The waits Argo held while the record said nothing (#1245, #1323) — each one a row the stream
/// carries no word about.
package struct FeedWaitsHeld: Equatable, Sendable {
    /// Whether the wait for the Session's first byte ran out with its process still up (#1245).
    /// Not read off the status: the row stands over a Session whose status has already fallen
    /// through to what the world readings say.
    package let startedQuietly: Bool
    /// The waits that have ENDED. Each appends a row and none of them is in the stream.
    package let settled: [SessionWaitSettled]

    /// No wait of Argo's to say anything about.
    package static let nothing = FeedWaitsHeld(startedQuietly: false, settled: [])

    package init(startedQuietly: Bool, settled: [SessionWaitSettled]) {
        self.startedQuietly = startedQuietly
        self.settled = settled
    }
}

/// Where Argo handed the work on, and the attempts that went nowhere (`CONTEXT.md` L2, #1327).
package struct FeedHandoffs: Equatable, Sendable {
    /// The handoff that LANDED — the link at the very foot of the reading.
    package let landed: FeedHandoff?
    /// The ones that did NOT, beside that link rather than at the head: `starting` and `resuming`
    /// wait for a process that has written no record, and a handoff runs well after one has.
    package let failed: [SessionWaitSettled]

    /// The work stayed here.
    package static let nothing = FeedHandoffs(landed: nil, failed: [])

    package init(landed: FeedHandoff?, failed: [SessionWaitSettled]) {
        self.landed = landed
        self.failed = failed
    }
}

/// What Argo's own gate is holding over this Session, and what the companion plugin reported into
/// it. None of the three is in the transcript: the CLI never wrote a word about any of them.
package struct FeedGateHolds: Equatable, Sendable {
    /// The question the gate is holding open, and whether this Session can be driven at all
    /// (#546, #1190).
    package let asking: FeedAskProjection.Asking
    /// The question the agent raised over the companion plugin (#1205). A claim about NOW rather
    /// than something appended to the stream, so a reading that stopped at the events would go on
    /// drawing an answered question.
    package let reported: Ask?
    /// The calls the gate refused because nobody answered (#573).
    package let expired: [PermissionExpiry]

    /// The gate is holding nothing. Spelled here rather than at each call site, because
    /// `FeedAskProjection.Asking.none` is not reachable from the specimens.
    package static let nothing = FeedGateHolds(asking: .none, reported: nil, expired: [])

    /// The gate holding a question and nothing else — the state every reading of a waiting Session
    /// is taken in. Named beside `nothing` so a field added here is answered in one place rather
    /// than pasted at each call.
    package static func holding(_ asking: FeedAskProjection.Asking) -> FeedGateHolds {
        FeedGateHolds(asking: asking, reported: nil, expired: [])
    }

    package init(asking: FeedAskProjection.Asking, reported: Ask?, expired: [PermissionExpiry]) {
        self.asking = asking
        self.reported = reported
        self.expired = expired
    }
}
