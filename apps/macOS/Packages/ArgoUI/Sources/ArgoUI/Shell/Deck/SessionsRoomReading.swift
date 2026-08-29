import ArgoEngine

/// Everything the Sessions deck draws about the selected Session, projected in ONE pass — where
/// five computed properties each resolved the selection and walked the event stream again.
///
/// Nothing here is cached. The presentation is a value the Hub rebuilds as the transcript grows, so
/// a remembered reading would draw the transcript as it stood when the reader last looked at it.
/// `CockpitView.reading` decides WHETHER to take one; this decides only what it says.
struct SessionsRoomReading {
    let feed: [FeedRow]
    let header: SessionHeaderProjection.Header?
    let showing: PlanShowing
    /// A fan-out's files grow while the reader is looking at one of them, so the Subagents are read
    /// with the feed rather than once per selection.
    let readings: FeedAgentReadings
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
    static func taken(
        in room: CockpitRoom,
        of presentation: CockpitPresentation,
        for sessionID: CockpitPresentation.Session.ID?,
    )
        -> SessionsRoomReading {
        guard room == .sessions else { return .none }
        return SessionsRoomReading(presentation: presentation, sessionID: sessionID)
    }

    private init() {
        self.feed = []
        self.header = nil
        self.showing = PlanShowing()
        self.readings = .none
        self.asking = FeedAskProjection.asking(for: nil)
    }

    init(presentation: CockpitPresentation, sessionID: CockpitPresentation.Session.ID?) {
        // Resolved once and handed to all five: the roster moves under an id, and two lookups in
        // one pass could answer with two different Sessions.
        let session = presentation.session(sessionID)
        let events = session?.events ?? []
        let asking = FeedAskProjection.asking(for: session)
        self.asking = asking
        self.feed = FeedProjection.rows(
            from: events,
            working: FeedWorking.isWorking(session),
            handedOff: presentation.handoff(of: sessionID),
            expired: session?.expiredPermissions ?? [],
            asking: asking,
        )
        self.header = session.map(SessionHeaderProjection.header(from:))
        self.showing = PlanShowing(plan: PlanProjection.reading(from: events))
        self.readings = FeedAgentReadings(events: session?.subagentEvents ?? [:])
    }
}
