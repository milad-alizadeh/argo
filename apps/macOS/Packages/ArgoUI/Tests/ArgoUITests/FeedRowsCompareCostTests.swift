@testable import ArgoUI
import Foundation
import Testing

/// What comparing two readings of a feed COSTS (ADR-0028 Rule 3 and Rule 7).
///
/// `FeedTableCoordinator.apply` asks whether the fresh rows are the reading that stands, on every
/// `updateNSView` — every frame of a seam drag included. Where the two share a buffer `Array.==` is
/// already O(1); where they do not, and the reading differs at its END, it walked all of it to find
/// out. A live Session differs at its last row more often than anywhere else: the row a running
/// call rewrites as it is answered.
///
/// RATIOS, never durations — the same comparison over a short reading and a long one.
///
/// Recorded on an Apple silicon laptop, debug, `swift test`, at 4 000 rows: a reading whose last
/// row was rewritten cost 771 µs before this and 0.50 µs after (1 500x), and a reload decided at
/// the seam 1.21 ms before and 0.29 µs after (4 200x).
///
/// One case is deliberately NOT gated: `FeedTableDelta.between` on a genuine append still walks the
/// whole prefix, because a prefix is only a prefix if all of it matches. 1.21 ms at 4 000 rows,
/// paid once per arriving batch rather than once per frame.
@Suite("Feed rows compare cost", .serialized)
struct FeedRowsCompareCostTests {
    /// The live-streaming case: same length, last row rewritten.
    @Test
    func `the same-reading test does not scale with the reading`() {
        let small = Self.perPass { Self.short.rewritten.isSameReading(as: Self.short.stale) }
        let large = Self.perPass { Self.long.rewritten.isSameReading(as: Self.long.stale) }

        #expect(!Self.short.stale.isSameReading(as: Self.short.rewritten))
        #expect(large < small * Self.flat)
    }

    /// The reload case: a reading that changed just inside its seam, which `starts(with:)` proved
    /// by walking everything in front of the change.
    @Test
    func `a reload is decided without walking the reading`() {
        let small = Self.perPass { Self.short.seam.extends(Self.short.stale) }
        let large = Self.perPass { Self.long.seam.extends(Self.long.stale) }

        #expect(FeedTableDelta.between(Self.short.stale, and: Self.short.seam) == .reload)
        #expect(large < small * Self.flat)
    }

    /// An append is still an append, and every already-shown row it invalidated is still named. The
    /// seam check in front of the walk may not change the answer.
    @Test
    func `an append is still read as an append`() {
        let appended = Self.long.stale + [FeedRow(id: 4000, content: .message("arrived"))]

        let delta = FeedTableDelta.between(Self.long.stale, and: appended)

        #expect(delta == .append(arrived: 4000 ..< 4001, rewritten: IndexSet(integer: 3999)))
    }

    private static let flat = 1.3
    /// Enough repeats that the block under the clock is MILLISECONDS of work. 100 of them is 30-50
    /// µs, inside which one frequency step or one stall lands whole, and a 1.3 bound on that is a
    /// bound at the instrument's floor: it failed 2 of 25 full-suite runs on unchanged code. 20 000
    /// is 6-10 ms a block (ADR-0028 Rule 8).
    private static let passes = 20000

    /// What one comparison costs, over `passes` of them: at half a microsecond, one clock reading
    /// measures the clock's granularity rather than the work.
    private static func perPass(_ work: () -> Bool) -> Double {
        leastCPUSeconds(trials: 20) { for _ in 0 ..< passes {
            _ = work()
        } } / Double(passes)
    }

    private static let short = Reading(rows: 300)
    private static let long = Reading(rows: 4000)

    /// One reading and the two ways a fresh one differs from it at the end — the last row
    /// rewritten, and the row inside the seam rewritten. Neither shares a buffer with `stale`,
    /// which is the case a fresh projection hands the coordinator.
    private struct Reading {
        let stale: [FeedRow]
        let rewritten: [FeedRow]
        let seam: [FeedRow]

        init(rows: Int) {
            self.stale = (0 ..< rows).map { FeedRow(id: $0, content: .message("row number \($0)")) }
            var last = stale
            last[rows - 1] = FeedRow(id: rows - 1, content: .message("answered"))
            self.rewritten = last
            var inside = stale
            inside[rows - 2] = FeedRow(id: rows - 2, content: .message("answered"))
            self.seam = inside
        }
    }
}
