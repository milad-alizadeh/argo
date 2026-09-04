@testable import ArgoUI
import Foundation
import Testing

/// How the compression answers a reading whose rows are NOT all one size, which is every real one.
/// An extension so the suite's own body stays inside its length gate.
extension MinimapGeometryTests {
    /// The shape a real transcript actually has: mostly one-line messages, with a long tool output
    /// or a gallery every so often. The compression has to hold for the MANY short rows, and the
    /// mean is the one statistic the long tail moves freely — 90% of this reading is 20pt and its
    /// mean is 98, so a grain taken off the mean draws those 810 rows at 0.41pt each, a fifth of
    /// the floor, and 270 of 300 adjacent pairs in the head band land closer than a mark and a gap.
    /// That is the smear #658 is about, arriving on the ordinary reading rather than the extreme
    /// one. Measured on a real 459-row session: 329 of 459 rows starved off the mean, 20 off the
    /// lower quartile.
    @Test
    func `a reading of many short rows and a few long ones keeps the short ones apart`() {
        let heights = (0 ..< 900).map { $0.isMultiple(of: 10) ? CGFloat(800) : CGFloat(20) }
        let reading = MinimapReading(
            rows: Self.rows(heights, turnedEvery: 10), columnWidth: 800, viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        let apart = ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap

        // The quartile, not the mean: the short rows are what the lane would mostly be drawing, so
        // they are what the question "does a mark a row fit" is asked about. Off the mean this
        // reading reads as fitting at a fifth of the compression its short rows can hold.
        #expect(lane.rowGrain == apart / 20)
        #expect(lane.rowGrain > lane.fitScale)

        // So it is drawn a mark a Turn — and at THAT granularity the same bound holds, by the same
        // construction: at most a quarter of the marks fall under a mark and a gap.
        #expect(lane.granularity == .turns)
        let extents = stride(from: 0, to: heights.count, by: 10).map { at in
            heights[at ..< at + 10].reduce(0, +)
        }
        let starved = extents.filter { $0 * lane.scale < apart }.count
        #expect(starved <= extents.count / 4, "\(starved) of \(extents.count) Turns starved")
    }
}
