import ArgoEngine
import Synchronization

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
        ///
        /// The one way to the stream, which is what makes `reads` below a count of the WORK: a
        /// comparison that walks the events has to come through here to reach them.
        public var events: [TranscriptEvent] {
            #if DEBUG
                reads.note()
            #endif
            return held
        }

        /// Which version of the above this is. Moved by every write the engine makes to it, by a
        /// `didSet` rather than by a caller remembering — see `TranscriptStream`.
        public let stamp: TranscriptStamp

        private let held: [TranscriptEvent]

        #if DEBUG
            /// How many times this stream has handed its events out, counted rather than timed
            /// (ADR-0028 Rule 8) — the count `CockpitPresentationCostTests` gates the comparison
            /// on. Per value, because a static one would be shared by every suite running beside
            /// it.
            let reads = StreamReads()
        #endif

        init(events: [TranscriptEvent], stamp: TranscriptStamp) {
            self.held = events
            self.stamp = stamp
        }

        /// The stamp ALONE, which is the whole point of the type.
        ///
        /// Two streams the engine grew apart always carry different stamps, so this never reports a
        /// stale reading as a fresh one. The streams of DIFFERENT Sessions can share a stamp, and
        /// that is sound here for one reason: `Session.id` is declared above its transcript, so the
        /// synthesised equality on `Session` has already said no before it asks this.
        public static func == (lhs: Self, rhs: Self) -> Bool {
            lhs.stamp == rhs.stamp
        }
    }
}

#if DEBUG
    /// How often one `Stream` was asked for its events. A reference, so that a stream held in a
    /// `let` still counts; atomic, because the value it hangs off is `Sendable` and nothing about
    /// a read promises which thread asks.
    final class StreamReads: Sendable {
        private let handed = Atomic<Int>(0)

        var count: Int {
            handed.load(ordering: .relaxed)
        }

        func note() {
            handed.wrappingAdd(1, ordering: .relaxed)
        }
    }
#endif
