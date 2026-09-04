@testable import ArgoUI
import Foundation
import Testing

/// Which granularity the overview lane draws a reading at, and what the coarser one buys (#1173).
///
/// Its own suite rather than a corner of `MinimapGeometryTests`, because the claim is a different
/// one: that suite is about where a place in the reading lands in the lane, and this is about what
/// one mark of the lane STANDS for. The rows are built with its fixture.
@Suite("Minimap granularity")
struct MinimapGranularityTests {
    private static let lane = CGSize(width: 100, height: 600)

    private static func geometry(_ reading: MinimapReading) -> MinimapGeometry {
        MinimapGeometry(reading, lane: lane)
    }

    /// 120 rows of 100pt in an 800pt column: short enough that the lane holds it a mark a row.
    private static func long() -> MinimapReading {
        MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 100, count: 120)),
            columnWidth: 800, viewportHeight: 600,
        )
    }

    /// The other regime: 2,048 rows of 64pt in Turns of four, which is 131,072pt of reading in 512
    /// Turns of 256. Fitting that in 600 points would draw each Turn at four thousandths of a
    /// point, far under the mark-and-gap the lane needs to draw two of them as two — so the grain
    /// holds the compression at two points per Turn's 256, and the miniature stands taller than
    /// the lane again, sliding inside it (#658).
    ///
    /// In TURNS since #1173, because rows are the granularity that no longer fits: a reading the
    /// lane cannot hold a mark a row is asked again a mark a Turn, and only where the Turns do not
    /// fit either is anything below the fold.
    ///
    /// Every number a power of two, and that is what the length is for rather than the length
    /// itself: `shortTurnHeight` counts extents into buckets a `quantum` wide, so a Turn's extent
    /// reads back exactly only where the quantum divides it. At 131,072pt over 2,048 buckets the
    /// quantum is 64, and 256 is four of them.
    private static func vast() -> MinimapReading {
        MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 64, count: 2048), turnedEvery: 4),
            columnWidth: 800,
            viewportHeight: 600,
        )
    }

    /// The claim the ladder is FOR: while the lane draws a mark a row, the whole session is in it.
    /// At row granularity the grain is a decision and never a compression — `scale` is the fit or
    /// the width's ratio, both of which put the miniature inside the lane (#1173).
    @Test
    func `a reading drawn a mark a row is never taller than the lane`() {
        let lane = Self.geometry(Self.long())
        #expect(lane.granularity == .rows)
        #expect(lane.miniatureHeight <= Self.lane.height)
    }

    /// And the step between them: the same reading one Turn longer in the rows is drawn a mark a
    /// Turn, and the whole of it comes back into the lane.
    @Test
    func `a session that will not fit a mark a row is drawn a mark a Turn, and fits`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 100, count: 300), turnedEvery: 10),
            columnWidth: 800, viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        #expect(lane.rowGrain > lane.fitScale)
        #expect(lane.turnGrain <= lane.fitScale)
        #expect(lane.granularity == .turns)
        #expect(lane.miniatureHeight <= Self.lane.height)
    }

    /// The latch: a running Session only grows, and the lane may not flip its whole appearance back
    /// and forth as it crosses. Once coarsened, coarse for the reading (#1173).
    @Test
    func `a reading the lane has coarsened stays coarse even where rows would fit`() {
        let held = MinimapGeometry(Self.long(), lane: Self.lane, coarsened: true)
        #expect(Self.geometry(Self.long()).granularity == .rows)
        #expect(held.granularity == .turns)
    }

    /// What the coarsening BUYS, on the session it was reported on: #650's 238 MB record, whose
    /// 5,000-odd rows in 550-odd Turns put 8% of itself in an 800pt lane a mark a row (#1173).
    ///
    /// Coverage is the share of the session in the lane at once — the lane's own height over the
    /// miniature's. The reading is the count model the ticket measured with, marks of one size
    /// against the 2pt floor, because that is what the figure in `PerfBudgets` was taken over and a
    /// gate read off a different shape would be a gate on the shape.
    @Test
    func `a session of #650's shape shows most of itself at Turn grain`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 40, count: 5004), turnedEvery: 9),
            columnWidth: 800, viewportHeight: 800,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 100, height: 800))
        let covered = lane.lane.height / lane.miniatureHeight

        #expect(lane.granularity == .turns)
        #expect(lane.turns.count == 556)
        #expect(covered > PerfBudgets.turnGrainCoverage, "\(covered) of the session in the lane")
    }

    /// Past the grain the lane stops compressing, because a mark thinner than the smallest one it
    /// draws maps nothing — so the miniature stands taller than the lane and slides again (#658).
    ///
    /// Read at the granularity the reading is drawn at, which for a session this long is Turns.
    @Test
    func `a session past the lane's grain is taller than the lane and slides inside it`() {
        let lane = Self.geometry(Self.vast())
        #expect(lane.granularity == .turns)
        #expect(lane.scale
            == (ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap) / 256)
        #expect(lane.miniatureHeight == 1024)
        #expect(lane.laneTravel == 443.3125)
    }

    /// Only of a session past the grain, which is the only one with a fold left to be below.
    @Test @MainActor
    func `the head of the session is off the top of the lane once the reader is far into it`() {
        let lane = Self.geometry(Self.vast())
        let end = lane.laneOffset(at: lane.offsetRange.upperBound)
        #expect(end == 443.3125)
        #expect(lane.rects(in: end ... end + Self.lane.height).allSatisfy { $0.y > 0 })
    }
}
