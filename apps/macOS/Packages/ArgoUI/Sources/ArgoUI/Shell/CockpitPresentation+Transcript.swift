import ArgoEngine

public extension CockpitPresentation.Session {
    /// What the transcript said, undigested — never the Transcript file itself (`CONTEXT.md` L2),
    /// which this projection does not carry. The two flat facts beside the stream are the record's
    /// two answers about a Turn Argo typed: `lostTurn` is the one that never reached it, and
    /// `submittedTurn` the one it has not answered yet.
    struct Transcript: Equatable, Sendable {
        /// The stream, compared by its stamp — see `Stream`, which is where the whole cost of this
        /// value is.
        public let stream: Stream
        public let lostTurn: String?
        /// The Turn Argo typed that nothing has answered, verbatim — see
        /// `HubSession.unansweredTurn`, whose whole reading this is. `nil` by default, which is
        /// degrade-down: a fixture that says nothing about a Turn is not one claiming a Turn is
        /// running.
        public let submittedTurn: String?

        /// Whether there IS such a Turn. Derived rather than stored beside the words, so the two
        /// readings cannot drift apart — a stored pair is how a feed comes to draw a Turn the
        /// composer has already released.
        public var hasUnansweredTurn: Bool {
            submittedTurn != nil
        }

        /// What a backgrounded delegation is holding open here (#1267) — see `DelegationHold`,
        /// whose whole reading this is. Beside `hasUnansweredTurn` because it answers the other
        /// half of the same question: that one says a Turn IS running when the status word does
        /// not, and this one says the record's open Turn is a child's rather than the parent's.
        ///
        /// `none` by default, on `hasUnansweredTurn`'s reasoning: a fixture that says nothing about
        /// a delegation is not one claiming a Turn is held by one.
        ///
        /// Set after the init rather than through it, and deliberately: that list is at the count
        /// it is grandfathered at (`swift-boundaries` edge 6), and one more parameter would
        /// authorise the next one. A fixture that wants this states it the same way.
        public var delegationHold = DelegationHold.none

        /// The stamp is the ENGINE's where one is handed over, and derived from the length where
        /// none is: a stream assembled by a fixture has no write history to count, and the default
        /// stamp would make every such stream compare equal to every other.
        public init(
            events: [TranscriptEvent] = [],
            transcriptStamp: TranscriptStamp? = nil,
            lostTurn: String? = nil,
            submittedTurn: String? = nil,
        ) {
            self.stream = Stream(
                events: events,
                stamp: transcriptStamp ?? TranscriptStamp(events: events),
            )
            self.lostTurn = lostTurn
            self.submittedTurn = submittedTurn
        }
    }
}
