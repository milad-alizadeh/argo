import ArgoEngine

public extension CockpitPresentation.Session {
    /// What the transcript said, undigested — never the Transcript file itself (`CONTEXT.md` L2),
    /// which this projection does not carry. `lostTurn` sits here as the one Turn that never
    /// reached it.
    struct Transcript: Equatable, Sendable {
        /// The two streams, compared by their stamp — see `Streams`, which is where the whole cost
        /// of this value is.
        public let streams: Streams
        public let lostTurn: String?

        /// The stamp is the ENGINE's where one is handed over, and derived from the two lengths
        /// where none is: a stream assembled by a fixture has no write history to count, and the
        /// default stamp would make every such stream compare equal to every other.
        public init(
            events: [TranscriptEvent] = [],
            subagentEvents: [String: [TranscriptEvent]] = [:],
            transcriptStamp: TranscriptStamp? = nil,
            lostTurn: String? = nil,
        ) {
            self.streams = Streams(
                events: events,
                subagentEvents: subagentEvents,
                stamp: transcriptStamp
                    ?? TranscriptStamp(events: events, subagentEvents: subagentEvents),
            )
            self.lostTurn = lostTurn
        }
    }
}

public extension CockpitPresentation.Session.Transcript {
    /// A Session's whole decoded stream, and the one number the cockpit compares it BY.
    ///
    /// SwiftUI diffs a presentation field by field, so `==` here runs once per Session per body
    /// pass. Walking two thousands-long streams to answer it was the single largest comparison in
    /// the cockpit, and it was paid on every pass in which nothing about the Session had changed
    /// (ADR-0028 Rule 1).
    ///
    /// Everything in this type is described by the stamp, and that is the rule for anything added
    /// to it: a fact here that the stamp cannot see would be a fact the cockpit stops redrawing
    /// for. Facts the stamp does NOT stand for belong one level up, on `Transcript`, where equality
    /// is synthesised.
    struct Streams: Equatable, Sendable {
        /// Everything the Session's transcript said, in order — the feed's whole input. The
        /// engine's own events, undigested; `FeedProjection` is what draws them.
        public let events: [TranscriptEvent]
        /// Each Subagent's own reading, keyed by the CLI's id for it (#711) — what the rail scopes
        /// the one feed onto. Undigested for the reason `events` is, and empty for the Session that
        /// delegated nothing, which is most of them.
        public let subagentEvents: [String: [TranscriptEvent]]
        /// Which version of the two above this is. Moved by every write the engine makes to either
        /// of them, by a `didSet` rather than by a caller remembering — see `TranscriptStream`.
        public let stamp: TranscriptStamp

        /// The stamp ALONE, which is the whole point of the type.
        ///
        /// Two streams the engine grew apart always carry different stamps, so this never reports a
        /// stale reading as a fresh one. Two streams of DIFFERENT Sessions can share a stamp, and
        /// that is sound here for one reason: `Session.id` is declared above its transcript, so the
        /// synthesised equality above has already said no before it asks this.
        public static func == (lhs: Self, rhs: Self) -> Bool {
            lhs.stamp == rhs.stamp
        }
    }
}
