@testable import ArgoUI
import Foundation
import Testing

/// Where each Turn's block stands in the miniature, and which one a place on the lane names (#382).
///
/// `MinimapTurnTests` proves where the reading BREAKS; this proves the break lands at the same
/// points the marks do. The two are separate suites because they fail for different reasons: one
/// is a boundary read wrong, the other is a boundary read right and drawn in the wrong place.
@Suite("Minimap Turn blocks")
struct MinimapBlockTests {
    /// Ten 100pt rows in an 800pt column beside a 100pt lane: eight to one, so every number below
    /// divides. Two Turns, broken by the stop reason on row 4.
    private static func geometry() -> MinimapGeometry {
        var rows = MinimapGeometryTests.rows(Array(repeating: 100, count: 10))
        rows[0].prompt = "First"
        rows[4].endsTurn = true
        rows[5].prompt = "Second"
        let reading = MinimapReading(rows: rows, columnWidth: 800, viewportHeight: 600)
        return MinimapGeometry(reading, lane: CGSize(width: 100, height: 600))
    }

    /// The whole miniature, which is what every claim about the set as a whole asks for.
    private static func blocks(_ lane: MinimapGeometry) -> [MinimapBlock] {
        lane.blocks(in: 0 ... lane.miniatureHeight)
    }

    @Test
    func `a block spans its Turn from the first row's head to the next Turn's`() {
        let blocks = Self.blocks(Self.geometry())
        #expect(blocks.map(\.y) == [0, 62.5])
        #expect(blocks.map(\.height) == [62.5, 62.5])
    }

    @Test
    func `a block carries the words its Turn opened with`() {
        #expect(Self.blocks(Self.geometry()).map(\.prompt) == ["First", "Second"])
    }

    /// A line-floored row can be DRAWN a touch short of the reading's own span. If a block ended
    /// where its last row was drawn to, the lane would have stripes naming no Turn at all — and a
    /// hover crossing one would drop the mark it had just put up.
    @Test
    func `a Turn holding a huge row still reaches the Turn after it`() {
        var rows = MinimapGeometryTests.rows([100, 20000, 100])
        rows[0].prompt = "First"
        rows[1].endsTurn = true
        rows[2].prompt = "Second"
        let lane = MinimapGeometry(
            MinimapReading(rows: rows, columnWidth: 800, viewportHeight: 600),
            lane: CGSize(width: 100, height: 600),
        )
        let blocks = Self.blocks(lane)

        #expect(blocks.count == 2)
        // The block fills its whole extent now — the gap the old per-event ceiling left is gone.
        #expect(blocks[1].range.lowerBound == lane.markY(row: 2))
        #expect(blocks[0].range.upperBound == blocks[1].range.lowerBound)
    }

    /// Every point over the reading names a Turn, so a pointer travelling down the lane never loses
    /// the mark it is carrying.
    @Test
    func `no place over the reading is left naming no Turn`() {
        let lane = Self.geometry()
        #expect(stride(from: 0.0, to: 125.0, by: 2.5).allSatisfy {
            lane.block(atMiniatureY: $0) != nil
        })
    }

    @Test
    func `a place in the miniature names the Turn it falls in`() {
        let lane = Self.geometry()
        #expect(lane.block(atMiniatureY: 10)?.prompt == "First")
        #expect(lane.block(atMiniatureY: 100)?.prompt == "Second")
    }

    @Test
    func `a place past the end of the reading names no Turn`() {
        #expect(Self.geometry().block(atMiniatureY: 4000) == nil)
    }

    /// The lane rasterises a band, so it asks for the blocks that band holds — including one that
    /// starts above it and runs into it, which is the common case for a long Turn.
    @Test
    func `a band holds every block that reaches into it`() {
        let lane = Self.geometry()
        #expect(lane.blocks(in: 70 ... 120).map(\.prompt) == ["Second"])
        #expect(lane.blocks(in: 60 ... 70).map(\.prompt) == ["First", "Second"])
    }

    @Test
    func `a reading with nothing in it draws no blocks`() {
        let lane = MinimapGeometry(
            MinimapReading(columnWidth: 800),
            lane: CGSize(width: 100, height: 600),
        )
        #expect(Self.blocks(lane).isEmpty)
    }
}
