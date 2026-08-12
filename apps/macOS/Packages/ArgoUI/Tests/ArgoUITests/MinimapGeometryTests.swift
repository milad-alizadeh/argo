@testable import ArgoUI
import Foundation
import Testing

/// The overview lane's whole arithmetic: where a row sits, how far the reading is compressed to
/// fit the lane, and what a mark on the lane means back in the reading.
///
/// Held as a suite because none of it is visible: a lane that maps the wrong place scrubs to the
/// wrong row and reads as a scroll bug, three surfaces away from the sum that was wrong.
///
/// The numbers are chosen to divide: sixty rows of a hundred points, six hundred on screen, in a
/// six-hundred-point lane. So the reading is compressed exactly ten to one, and every expectation
/// below is a number rather than the implementation's own formula written twice.
@Suite("Minimap geometry")
struct MinimapGeometryTests {
    private static func long() -> MinimapReading {
        MinimapReading(rowHeights: Array(repeating: 100, count: 60), viewportHeight: 600)
    }

    @Test
    func `a reading taller than the lane is compressed to fit it`() {
        #expect(MinimapGeometry(Self.long(), laneHeight: 600).scale == 0.1)
    }

    @Test
    func `a reading shorter than the lane is drawn at its own size`() {
        let reading = MinimapReading(rowHeights: [80, 80], viewportHeight: 600)
        #expect(MinimapGeometry(reading, laneHeight: 600).scale == 1)
    }

    @Test
    func `an empty reading maps nothing`() {
        let lane = MinimapGeometry(MinimapReading(), laneHeight: 600)
        #expect(lane.marks.isEmpty)
        #expect(lane.documentHeight == 0)
        #expect(lane.isScrollable == false)
    }

    @Test
    func `each row's mark sits at its own place in the reading`() {
        let reading = MinimapReading(rowHeights: [100, 300, 50], viewportHeight: 200, topInset: 24)
        let lane = MinimapGeometry(reading, laneHeight: 600)
        #expect(lane.documentY(row: 0) == 0)
        #expect(lane.documentY(row: 1) == 100)
        #expect(lane.documentY(row: 2) == 400)
        // The top gutter is scrollable too, so the first mark starts below it.
        #expect(lane.marks.map(\.y) == [24, 124, 424])
    }

    @Test
    func `no single row may consume the overview in proportion to what it holds`() {
        let reading = MinimapReading(rowHeights: [40, 20000], viewportHeight: 600)
        let lane = MinimapGeometry(reading, laneHeight: 600)
        #expect(lane.marks[1].height == 90)
    }

    @Test
    func `a reading drawn at its own size gives each row the height it has`() {
        // Nothing to compress and nothing near the cap, so the marks ARE the rows: this is the
        // case where the lane is a true miniature rather than a summary of one.
        let reading = MinimapReading(rowHeights: [100, 60, 40], viewportHeight: 900)
        let lane = MinimapGeometry(reading, laneHeight: 900)
        let gap = ArgoMinimapLane.markGap
        #expect(lane.marks.map(\.height) == [100 - gap, 60 - gap, 40 - gap])
    }

    @Test
    func `a row compressed below what can be seen is drawn at the floor`() {
        let lane = MinimapGeometry(Self.long(), laneHeight: 60)
        #expect(lane.marks.allSatisfy { $0.height == ArgoMinimapLane.markMinimumHeight })
    }

    @Test
    func `the reading may be scrolled from its top gutter to the end of its last row`() {
        let reading = MinimapReading(
            rowHeights: Array(repeating: 100, count: 60),
            viewportHeight: 600,
            topInset: 24,
            bottomInset: 24,
        )
        let lane = MinimapGeometry(reading, laneHeight: 600)
        #expect(lane.offsetRange.lowerBound == -24)
        #expect(lane.offsetRange.upperBound == 5424)
    }

    @Test
    func `a reading that fits on screen cannot be scrolled`() {
        let reading = MinimapReading(rowHeights: [100, 100], viewportHeight: 600)
        let lane = MinimapGeometry(reading, laneHeight: 600)
        #expect(lane.isScrollable == false)
        #expect(lane.viewportY(at: 0) == 0)
    }

    @Test
    func `the viewport rectangle stands for the share of the reading on screen`() {
        // A tenth of the reading is on screen, so the rectangle is a tenth of the lane.
        #expect(MinimapGeometry(Self.long(), laneHeight: 600).viewportHeightInLane == 60)
    }

    @Test
    func `a viewport too thin to grab is drawn at the floor`() {
        let reading = MinimapReading(
            rowHeights: Array(repeating: 100, count: 2000), viewportHeight: 600,
        )
        let lane = MinimapGeometry(reading, laneHeight: 600)
        #expect(lane.viewportHeightInLane == ArgoMinimapLane.viewportMinimumHeight)
    }

    @Test
    func `the reading at its end puts the viewport rectangle at the foot of the lane`() {
        let lane = MinimapGeometry(Self.long(), laneHeight: 600)
        #expect(lane.viewportY(at: lane.offsetRange.upperBound) == 540)
    }

    @Test
    func `the reading at its start puts the viewport rectangle at the head of the lane`() {
        let lane = MinimapGeometry(Self.long(), laneHeight: 600)
        #expect(lane.viewportY(at: lane.offsetRange.lowerBound) == 0)
    }

    @Test
    func `a scrub maps the rectangle's own travel onto the reading's, not the lane's`() {
        let lane = MinimapGeometry(Self.long(), laneHeight: 600)
        // The rectangle travels 540 of the lane's 600, over a reading that travels 5400. So half
        // its travel is halfway through the reading — and half the LANE is not, which is the whole
        // difference between a slider ratio and a 1:1 mapping.
        #expect(lane.offset(forViewportY: 270) == 2700)
        #expect(lane.offset(forViewportY: 300) != 2700)
    }

    @Test
    func `a scrub past either end of the lane stops at the end of the reading`() {
        let lane = MinimapGeometry(Self.long(), laneHeight: 600)
        #expect(lane.offset(forViewportY: -400) == 0)
        #expect(lane.offset(forViewportY: 4000) == 5400)
    }

    @Test
    func `a click centres the viewport rectangle on the place that was clicked`() {
        let lane = MinimapGeometry(Self.long(), laneHeight: 600)
        let landed = lane.offset(centringLaneY: 400)
        #expect(lane.viewportY(at: landed) + lane.viewportHeightInLane / 2 == 400)
    }
}
