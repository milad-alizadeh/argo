import ArgoEngine

/// Everything the Sessions deck draws about the selected Session, projected in ONE pass — where
/// five computed properties each resolved the selection and walked the event stream again.
///
/// The parts that WALK the stream are remembered by `SessionsRoomReadingCache`, under a stamp of
/// the inputs they are a pure function of — the presentation is a value the Hub rebuilds
/// as the transcript grows, so a reading remembered under anything weaker would draw the transcript
/// as it stood when the reader last looked at it.
/// `CockpitView.reading` decides WHETHER to take one; this decides only what it says.
struct SessionsRoomReading {
    let feed: [FeedRow]
    /// The wait Argo is HOLDING on this Session, if any — the plinth's, and the one the reading
    /// carries no row for. DIRECT and managed-only by construction: it is read off the engine's own
    /// `starting`, which no observed Session can reach.
    let wait: FeedWait?
    /// Whether Argo itself submitted the Turn now in flight (#1179, #1323) — the DIRECT gate
    /// `EnvironmentValues.argoTurnIsDirect` carries down to `FeedColumn`. Read straight off the
    /// stamp rather than through the memoized `body` below: it is a status fact and not a stream
    /// walk, on the same ground `stamp.status` itself is.
    let hasUnansweredTurn: Bool
    let header: SessionHeaderProjection.Header?
    let showing: PlanShowing
    /// Which version of the Session's record this reading was taken at, handed on so the Subagent
    /// reader the shell carries can share the memos keyed by it (#858, #1005). Absent for the
    /// reading a room that draws no transcript does not take.
    let stamp: SessionsRoomReadingCache.Stamp?
    /// What the feed's ask rows are told about answering: the question Argo is holding open, and
    /// whether this Session can be driven at all (#546).
    let asking: FeedAskProjection.Asking

    /// The reading for a room that draws no transcript: not a Session with nothing in it, but no
    /// reading taken at all.
    static let none = SessionsRoomReading()

    /// The selected Session's reading in the room that DRAWS a transcript, and nothing at all in
    /// the other two — the projection walks the whole event stream, and `CockpitView.body` runs in
    /// every room.
    ///
    /// The gate is a cost that was measured, not assumed (#858): an ungated reading cost a 100-230
    /// ms main-thread stall on every transcript batch in the rooms that draw no transcript, where a
    /// gated one costs nothing at all. Here rather than on `CockpitView` so the shell has ONE place
    /// that takes a reading and every other reader is handed the value (#957).
    @MainActor static func taken(
        in room: CockpitRoom,
        of presentation: CockpitPresentation,
        for sessionID: CockpitPresentation.Session.ID?,
    )
        -> SessionsRoomReading {
        guard room == .sessions else { return .none }
        #if DEBUG
            tally.taken += 1
        #endif
        return SessionsRoomReading(presentation: presentation, sessionID: sessionID)
    }

    #if DEBUG
        /// See `SessionsRoomReadingTally`.
        @MainActor static var tally = SessionsRoomReadingTally()
    #endif

    private init() {
        self.feed = []
        self.wait = nil
        self.hasUnansweredTurn = false
        self.header = nil
        self.showing = PlanShowing()
        self.stamp = nil
        self.asking = FeedAskProjection.asking(for: nil)
    }

    @MainActor init(presentation: CockpitPresentation, sessionID: CockpitPresentation.Session.ID?) {
        #if DEBUG
            Self.tally.constructed += 1
        #endif
        // Resolved once and handed to all five: the roster moves under an id, and two lookups in
        // one pass could answer with two different Sessions.
        let session = presentation.session(sessionID)
        let asking = FeedAskProjection.asking(for: session)
        let handedOff = presentation.handoff(of: sessionID)
        self.asking = asking
        let stamp = SessionsRoomReadingCache.Stamp(
            of: session,
            asking: asking,
            handedOff: handedOff,
        )
        self.stamp = stamp
        let body = SessionsRoomReadingCache.body(at: stamp) {
            Self.body(of: session, at: stamp, asking: asking, handedOff: handedOff)
        }
        self.feed = body.feed
        self.wait = body.wait
        self.hasUnansweredTurn = stamp.hasUnansweredTurn
        self.showing = body.showing
        // Taken every pass, and only its one stream walk remembered: the header reads facts that
        // move with no event appended — spend, context, what the roster calls the Session — so
        // remembering the whole of it would draw them as they stood when the reader last looked.
        self.header = session.map {
            SessionHeaderProjection.header(
                from: $0,
                // The ROSTER's own answer, so a Session that has given its Ticket's words up to a
                // rival row reads the same title here that row draws — and one whose only rival
                // is a row the reader cannot see keeps them on both surfaces (#1391, #1251).
                title: SessionRosterProjection.namedTitle(
                    for: $0.id, among: presentation.sessions,
                ),
                worked: body.worked,
            )
        }
    }

    /// The one stream walk a pass pays for, and the only part of a reading the cache remembers.
    ///
    /// Lifted out of the initializer above rather than left inline, because two lanes each added a
    /// few lines to it and the pair went one line past SwiftLint's body cap while each was under
    /// it alone (#1442). It reads better named in any case: what the cache holds is this, and the
    /// initializer's job is the four facts around it that no stamp can remember.
    @MainActor private static func body(
        of session: CockpitPresentation.Session?,
        at stamp: SessionsRoomReadingCache.Stamp,
        asking: FeedAskProjection.Asking,
        handedOff: FeedHandoff?,
    )
        -> SessionsRoomReadingCache.Body {
        SessionsRoomReadingCache.Body(
            feed: FeedProjection.rows(
                from: session?.events ?? [],
                working: FeedWorking.isWorking(stamp.status),
                startedQuietly: stamp.startedQuietly,
                settledWaits: stamp.settledWaits,
                handoffFailures: stamp.handoffFailures,
                handedOff: handedOff,
                expired: stamp.expired,
                asking: asking,
                reported: stamp.reported,
            ),
            // Off the engine's own facts, which are DIRECT and managed-only, and never off an
            // empty reading: a Session observed from outside that has written nothing is a
            // Session nobody here started, and a plinth over it would claim an act Argo did not
            // perform. A running handoff outranks the startup wait — the two cannot overlap,
            // since a Session running `/handoff` has long since printed its first byte — and
            // `resuming` picks which of the two identical startup waits this is.
            wait: stamp.handingOff
                ? .handingOff
                : (FeedWorking.isStarting(stamp.status)
                    ? (stamp.resuming ? .resuming : .starting)
                    : nil),
            showing: PlanShowing(
                plan: PlanProjection.reading(from: session?.events ?? []),
                // The same reading the row's own `PlanBar` freezes on (#1345): a Session
                // that is not running is not progressing.
                isStill: !FeedWorking.isWorking(stamp.status),
            ),
            worked: .read(across: session?.events ?? []),
        )
    }
}

/// How many readings a pass TOOK against how many were BUILT in it — the gate on #957.
///
/// A construction is one `SessionsRoomReading(presentation:sessionID:)`, whether or not
/// `SessionsRoomReadingCache` answered it out of what it already held. That distinction is the
/// whole reason this counter exists rather than the cache's: the second reading of a pass is a
/// cache HIT, so it walks no stream and `SessionsRoomReadingCache.cost` stays at one while the
/// shell builds two. What is expensive about the second reading is not the walk — it is the
/// selection lookup, the ask projection and the header walk that no stamp remembers.
///
/// `taken` counts only where it actually takes one, so both numbers are zero in a room that draws
/// no transcript.
struct SessionsRoomReadingTally {
    var taken = 0
    var constructed = 0

    /// Everything counted, dropped. For a suite that needs to count one pass rather than a run.
    @MainActor static func forget() {
        #if DEBUG
            SessionsRoomReading.tally = SessionsRoomReadingTally()
        #endif
    }
}
