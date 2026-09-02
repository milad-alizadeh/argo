import ArgoEngine
#if DEBUG
    import Synchronization
#endif

/// A Session's decoded events, and the count of the times they were handed out.
///
/// **In a file of its own, and that is the mechanism rather than tidiness.** Swift's `private` is
/// FILE-scoped, so storage declared beside `Stream.==` would let a comparison read the array
/// without passing the accessor that counts — and `CockpitPresentationCostTests` would stay green
/// through the whole-stream walk it exists to catch (#1070). Here, the only thing the stream's own
/// file can reach is `events`.
struct HeldEvents: Sendable {
    /// The one way to the events, which is what makes `reads` a count of the WORK: anything that
    /// walks the stream has to come through here to reach it.
    var events: [TranscriptEvent] {
        #if DEBUG
            reads.note()
        #endif
        return held
    }

    #if DEBUG
        /// How many times this stream has handed its events out, counted rather than timed
        /// (ADR-0028 Rule 8) — the count `CockpitPresentationCostTests` gates a presentation
        /// comparison on. Per value, because a static one would be shared by every suite running
        /// beside it.
        let reads = Reads()

        /// How often one stream was asked for its events. A reference, so that a stream held in a
        /// `let` still counts; atomic, because the value it hangs off is `Sendable` and nothing
        /// about a read promises which thread asks.
        final class Reads: Sendable {
            private let handed = Atomic<Int>(0)

            var count: Int {
                handed.load(ordering: .relaxed)
            }

            fileprivate func note() {
                handed.wrappingAdd(1, ordering: .relaxed)
            }
        }
    #endif

    private let held: [TranscriptEvent]

    init(_ events: [TranscriptEvent]) {
        self.held = events
    }
}
