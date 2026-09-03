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
/// story: 12,000 points of reading fitted into a 600pt lane compresses exactly twenty to one.
@Suite("Minimap geometry")
struct MinimapGeometryTests {
    private static let lane = CGSize(width: 100, height: 600)

    /// 120 rows of 100pt in an 800pt column: 12,000pt of reading, 600 of it on screen. Long enough
    /// that the widths' ratio would not fit it, and short enough that the lane fits it anyway —
    /// the compression is 600 over 12,000, and the whole session is mapped at once.
    private static func long() -> MinimapReading {
        MinimapReading(
            rows: rows(Array(repeating: 100, count: 120)), columnWidth: 800, viewportHeight: 600,
        )
    }

    /// The other regime: 1,000 rows of 100pt, which is 100,000pt of reading. Fitting that in 600
    /// points would draw each row at six hundredths of a point, far under the mark-and-gap the lane
    /// needs to draw two rows as two — so the grain holds the compression at two points per row's
    /// 100, and the miniature stands taller than the lane again, sliding inside it (#658).
    private static func vast() -> MinimapReading {
        MinimapReading(
            rows: rows(Array(repeating: 100, count: 1000)), columnWidth: 800, viewportHeight: 600,
        )
    }

    /// Rows carrying one drawn line apiece. What shape a row makes is `MinimapRowTests`; these are
    /// about where it lands and how tall it stands.
    static func rows(_ heights: [CGFloat]) -> [MinimapRow] {
        heights.map { MinimapRow(height: $0, shape: .oneLine) }
    }

    private static func geometry(_ reading: MinimapReading) -> MinimapGeometry {
        MinimapGeometry(reading, lane: lane)
    }

    /// A reading short enough that neither the lane's height nor the grain binds — what is left is
    /// the widths' own ratio, and the cap on it.
    private static func short(columnWidth: CGFloat) -> MinimapReading {
        MinimapReading(rows: rows([200, 200]), columnWidth: columnWidth, viewportHeight: 300)
    }

    /// The claim the lane is for: a session of any length the lane can draw is mapped WHOLE, so
    /// the reader is never scrolling the map of the thing they are scrolling (#1132).
    @Test
    func `the compression is what puts the whole session in the lane`() {
        #expect(Self.geometry(Self.long()).scale == 0.05)
    }

    /// And the width is the ceiling on it, not the ratio: fitting must never MAGNIFY the reading.
    @Test
    func `the lane's width caps the compression, so a short reading is never magnified`() {
        #expect(Self.geometry(Self.short(columnWidth: 80)).scale == 1)
        // The same reading against a column it would be compressed for — the cap binds one way.
        #expect(Self.geometry(Self.short(columnWidth: 800)).scale == 0.125)
    }

    @Test
    func `a column not yet laid out compresses nothing`() {
        #expect(Self.geometry(Self.short(columnWidth: 0)).scale == 1)
    }

    @Test
    func `a session the lane can hold is drawn in it whole, with nothing below the fold`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.miniatureHeight == 600)
        #expect(lane.laneTravel == 0)
    }

    /// Past the grain the lane stops compressing, because a row thinner than the smallest mark it
    /// draws maps nothing — so the miniature stands taller than the lane and slides again (#658).
    @Test
    func `a session past the lane's grain is taller than the lane and slides inside it`() {
        let lane = Self.geometry(Self.vast())
        #expect(lane.scale
            == (ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap) / 100)
        #expect(lane.miniatureHeight == 2000)
        #expect(lane.laneTravel == 1412)
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

    @Test @MainActor
    func `an empty reading maps nothing`() {
        let lane = Self.geometry(MinimapReading(columnWidth: 800))
        #expect(lane.rects(in: 0 ... 600).isEmpty)
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
        #expect(lane.offsetRange.upperBound == 11424)
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
        #expect(Self.geometry(Self.long()).viewportHeightInLane == 30)
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
        #expect(lane.viewportY(at: lane.offsetRange.upperBound) == 570)
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
        // A tenth of a point: the compression here is the width's 1/80, which no binary fraction
        // lands on.
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

    /// Only of a session past the grain, which is the only one with a fold left to be below.
    @Test @MainActor
    func `the head of the session is off the top of the lane once the reader is far into it`() {
        let lane = Self.geometry(Self.vast())
        let end = lane.laneOffset(at: lane.offsetRange.upperBound)
        #expect(end == 1412)
        #expect(lane.rects(in: end ... end + Self.lane.height).allSatisfy { $0.y > 0 })
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
        #expect(lane.offset(forLaneY: 4000) == 11400)
    }

    @Test
    func `a click centres the viewport rectangle on the place that was clicked`() {
        let lane = Self.geometry(Self.long())
        let landed = lane.offset(centringLaneY: 400)
        #expect(abs(lane.viewportY(at: landed) + lane.viewportHeightInLane / 2 - 400) < 0.001)
    }
}
