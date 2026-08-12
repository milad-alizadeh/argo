@testable import ArgoUI
import Foundation
import Testing

/// The overview lane's whole arithmetic: how far the reading is compressed, where a row sits in the
/// miniature, how far the miniature has slid inside the lane, and what a place on the lane means
/// back in the reading.
///
/// Held as a suite because none of it is visible: a lane that maps the wrong place scrubs to the
/// wrong row and reads as a scroll bug, three surfaces away from the sum that was wrong.
///
/// The numbers are chosen to divide, and to divide in binary so no expectation below is a rounding
/// story: a 100pt lane beside an 800pt column compresses exactly eight to one.
@Suite("Minimap geometry")
struct MinimapGeometryTests {
    private static let lane = CGSize(width: 100, height: 600)

    /// 111 rows of 100pt in an 800pt column: 11,100pt of reading, 600 of it on screen.
    private static func long() -> MinimapReading {
        MinimapReading(
            rows: rows(Array(repeating: 100, count: 111)), columnWidth: 800, viewportHeight: 600,
        )
    }

    /// Rows carrying a line of prose apiece. What shape a row makes is `MinimapRowTests`; these are
    /// about where it lands and how tall it stands.
    static func rows(_ heights: [CGFloat]) -> [MinimapRow] {
        heights.map { MinimapRow(height: $0, shape: .sentence(length: 40, ink: .command)) }
    }

    private static func geometry(_ reading: MinimapReading) -> MinimapGeometry {
        MinimapGeometry(reading, lane: lane)
    }

    @Test
    func `the compression is the lane's width over the feed column's`() {
        #expect(Self.geometry(Self.long()).scale == 0.125)
    }

    @Test
    func `a column narrower than the lane is drawn at its own size rather than magnified`() {
        var reading = Self.long()
        reading.columnWidth = 80
        #expect(Self.geometry(reading).scale == 1)
    }

    @Test
    func `a column not yet laid out compresses nothing`() {
        var reading = Self.long()
        reading.columnWidth = 0
        #expect(Self.geometry(reading).scale == 1)
    }

    @Test
    func `the miniature is taller than the lane, so the rest of it is below the fold`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.miniatureHeight == 1387.5)
        #expect(lane.laneTravel == 787.5)
    }

    @Test
    func `a reading whose miniature fits the lane does not slide inside it`() {
        let reading = MinimapReading(
            rows: Self.rows([400, 400]), columnWidth: 800, viewportHeight: 300,
        )
        let lane = Self.geometry(reading)
        #expect(lane.miniatureHeight == 100)
        #expect(lane.laneTravel == 0)
        #expect(lane.laneOffset(at: lane.offsetRange.upperBound) == 0)
    }

    @Test
    func `an empty reading maps nothing`() {
        let lane = Self.geometry(MinimapReading(columnWidth: 800))
        #expect(lane.marks(in: 0 ... 600).isEmpty)
        #expect(lane.documentHeight == 0)
        #expect(lane.isScrollable == false)
    }

    @Test
    func `the reading may be scrolled from its top gutter to the end of its last row`() {
        var reading = Self.long()
        reading.topInset = 24
        reading.bottomInset = 24
        let lane = Self.geometry(reading)
        #expect(lane.offsetRange.lowerBound == -24)
        #expect(lane.offsetRange.upperBound == 10524)
    }

    @Test
    func `a reading that fits on screen cannot be scrolled`() {
        let reading = MinimapReading(
            rows: Self.rows([100, 100]), columnWidth: 800, viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        #expect(lane.isScrollable == false)
        #expect(lane.viewportY(at: 0) == 0)
    }

    @Test
    func `the viewport rectangle stands for the visible range at the same compression`() {
        #expect(Self.geometry(Self.long()).viewportHeightInLane == 75)
    }

    @Test
    func `a viewport too thin to grab is drawn at the floor`() {
        let reading = MinimapReading(
            rows: Self.rows(Array(repeating: 100, count: 200)), columnWidth: 8000,
            viewportHeight: 600,
        )
        let floor = ArgoMinimapLane.viewportMinimumHeight
        #expect(Self.geometry(reading).viewportHeightInLane == floor)
    }

    @Test
    func `the reading at its end puts the viewport rectangle at the foot of the lane`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.viewportY(at: lane.offsetRange.upperBound) == 525)
    }

    /// The floor draws the lit range taller than it truly is, and the miniature slides that much
    /// further for it — so the range still ends flush rather than overshooting the lane's foot.
    @Test
    func `a viewport held up by the floor still ends flush with the lane`() {
        let reading = MinimapReading(
            rows: Self.rows(Array(repeating: 100, count: 20000)), columnWidth: 8000,
            viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        #expect(lane.viewportHeightInLane == ArgoMinimapLane.viewportMinimumHeight)
        // A tenth of a point: the compression here is 1/80, which no binary fraction lands on.
        #expect(abs(lane.viewportY(at: lane.offsetRange.upperBound) - 576) < 0.1)
    }

    /// A lane with no room left over the lit range cannot solve for a slide, and a click on one
    /// must still name the place it landed on rather than snapping the reading to its head.
    @Test
    func `a lane no taller than its lit range still maps a click`() {
        let reading = MinimapReading(
            rows: Self.rows(Array(repeating: 100, count: 60)), columnWidth: 800,
            viewportHeight: 4800,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 100, height: 20))
        #expect(lane.offset(forLaneY: 10) > lane.offsetRange.lowerBound)
    }

    @Test
    func `the reading at its start puts the viewport rectangle at the head of the lane`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.viewportY(at: lane.offsetRange.lowerBound) == 0)
        #expect(lane.laneOffset(at: lane.offsetRange.lowerBound) == 0)
    }

    @Test
    func `the head of the session is off the top of the lane once the reader is far into it`() {
        let lane = Self.geometry(Self.long())
        let end = lane.laneOffset(at: lane.offsetRange.upperBound)
        #expect(end == 787.5)
        #expect(lane.marks(in: end ... end + Self.lane.height).allSatisfy { $0.y > 0 })
    }

    /// Both directions of the one mapping click and drag go through. The inverse is a division, so
    /// it is read to a thousandth of a point rather than to the last bit.
    @Test
    func `a place in the lane is the place in the reading it is drawn at`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.viewportY(at: 5250) == 262.5)
        #expect(abs(lane.offset(forLaneY: 262.5) - 5250) < 0.001)
    }

    @Test
    func `a scrub past either end of the lane stops at the end of the reading`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.offset(forLaneY: -400) == 0)
        #expect(lane.offset(forLaneY: 4000) == 10500)
    }

    @Test
    func `a click centres the viewport rectangle on the place that was clicked`() {
        let lane = Self.geometry(Self.long())
        let landed = lane.offset(centringLaneY: 400)
        #expect(abs(lane.viewportY(at: landed) + lane.viewportHeightInLane / 2 - 400) < 0.001)
    }
}
