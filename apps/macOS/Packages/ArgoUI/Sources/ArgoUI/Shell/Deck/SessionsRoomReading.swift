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
            SessionsRoomReadingCache.Body(
                feed: FeedProjection.rows(
                    from: session?.events ?? [],
                    working: stamp.liveness.isRunning,
                    starting: stamp.isStarting,
                    handedOff: handedOff,
                    expired: stamp.expired,
                    asking: asking,
                ),
                showing: PlanShowing(plan: PlanProjection.reading(from: session?.events ?? [])),
                worked: .read(across: session?.events ?? []),
            )
        }
        self.feed = body.feed
        self.showing = body.showing
        // Taken every pass, and only its one stream walk remembered: the header reads facts that
        // move with no event appended — spend, context, what the roster calls the Session — so
        // remembering the whole of it would draw them as they stood when the reader last looked.
        self.header = session.map { SessionHeaderProjection.header(from: $0, worked: body.worked) }
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
