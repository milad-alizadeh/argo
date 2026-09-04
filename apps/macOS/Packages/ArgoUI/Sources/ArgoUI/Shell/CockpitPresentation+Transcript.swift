import ArgoEngine

public extension CockpitPresentation.Session {
    /// What the transcript said, undigested — never the Transcript file itself (`CONTEXT.md` L2),
    /// which this projection does not carry. The two flat facts beside the stream are the record's
    /// two answers about a Turn Argo typed: `lostTurn` is the one that never reached it, and
    /// `hasUnansweredTurn` the one it has not answered yet.
    struct Transcript: Equatable, Sendable {
        /// The stream, compared by its stamp — see `Stream`, which is where the whole cost of this
        /// value is.
        public let stream: Stream
        public let lostTurn: String?
        /// Whether Argo has typed a Turn nothing has answered — see `HubSession.hasUnansweredTurn`,
        /// whose whole reading this is. `false` by default, which is degrade-down: a fixture that
        /// says nothing about a Turn is not one claiming a Turn is running.
        public let hasUnansweredTurn: Bool

        /// The stamp is the ENGINE's where one is handed over, and derived from the length where
        /// none is: a stream assembled by a fixture has no write history to count, and the default
        /// stamp would make every such stream compare equal to every other.
        public init(
            events: [TranscriptEvent] = [],
            transcriptStamp: TranscriptStamp? = nil,
            lostTurn: String? = nil,
            hasUnansweredTurn: Bool = false,
        ) {
            self.stream = Stream(
                events: events,
                stamp: transcriptStamp ?? TranscriptStamp(events: events),
            )
            self.lostTurn = lostTurn
            self.hasUnansweredTurn = hasUnansweredTurn
        }
    }
}
