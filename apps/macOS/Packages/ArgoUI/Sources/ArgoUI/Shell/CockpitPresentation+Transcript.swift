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

public extension CockpitPresentation.Session.Transcript {
    /// A Session's whole decoded stream, and the one number the cockpit compares it BY.
    ///
    /// A Subagent's own reading is NOT here since #858: it is the child's, it moves whenever any
    /// fan-out writes, and carried here it made every one of those writes a reason to rebuild the
    /// whole cockpit. `FeedAgentReader` is where a lane asks for one.
    ///
    /// SwiftUI diffs a presentation field by field, so `==` here runs once per Session per body
    /// pass. Walking a thousands-long stream to answer it was the single largest comparison in
    /// the cockpit, and it was paid on every pass in which nothing about the Session had changed
    /// (ADR-0028 Rule 1).
    ///
    /// Everything in this type is described by the stamp, and that is the rule for anything added
    /// to it: a fact here that the stamp cannot see would be a fact the cockpit stops redrawing
    /// for. Facts the stamp does NOT stand for belong one level up, on `Transcript`, where equality
    /// is synthesised.
    struct Stream: Equatable, Sendable {
        /// Everything the Session's transcript said, in order — the feed's whole input. The
        /// engine's own events, undigested; `FeedProjection` is what draws them.
        public let events: [TranscriptEvent]
        /// Which version of the above this is. Moved by every write the engine makes to it, by a
        /// `didSet` rather than by a caller remembering — see `TranscriptStream`.
        public let stamp: TranscriptStamp

        /// The stamp ALONE, which is the whole point of the type.
        ///
        /// Two streams the engine grew apart always carry different stamps, so this never reports a
        /// stale reading as a fresh one. The streams of DIFFERENT Sessions can share a stamp, and
        /// that is sound here for one reason: `Session.id` is declared above its transcript, so the
        /// synthesised equality above has already said no before it asks this.
        public static func == (lhs: Self, rhs: Self) -> Bool {
            lhs.stamp == rhs.stamp
        }
    }
}
