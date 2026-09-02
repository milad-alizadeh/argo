import ArgoEngine

public extension CockpitPresentation.Session {
    /// What the transcript said, undigested — never the Transcript file itself (`CONTEXT.md` L2),
    /// which this projection does not carry. `lostTurn` sits here as the one Turn that never
    /// reached it.
    struct Transcript: Equatable, Sendable {
        /// The stream, compared by its stamp — see `Stream`, which is where the whole cost of this
        /// value is.
        public let stream: Stream
        public let lostTurn: String?

        /// The stamp is the ENGINE's where one is handed over, and derived from the length where
        /// none is: a stream assembled by a fixture has no write history to count, and the default
        /// stamp would make every such stream compare equal to every other.
        public init(
            events: [TranscriptEvent] = [],
            transcriptStamp: TranscriptStamp? = nil,
            lostTurn: String? = nil,
        ) {
            self.stream = Stream(
                events: events,
                stamp: transcriptStamp ?? TranscriptStamp(events: events),
            )
            self.lostTurn = lostTurn
        }
    }
}
