@testable import ArgoUI
import Foundation
import Testing

/// Where a row's block lands in the miniature and how tall it stands — the half of the arithmetic
/// that decides what is drawn, as against `MinimapGeometryTests`, which is where the reading sits.
///
/// The numbers divide in binary so no expectation here is a rounding story: a 100pt lane beside an
/// 800pt column compresses exactly eight to one.
@Suite("Minimap marks")
struct MinimapMarkTests {
    private static func geometry(_ reading: MinimapReading) -> MinimapGeometry {
        MinimapGeometry(reading, lane: CGSize(width: 100, height: 600))
    }

    @Test
    func `each row's mark sits at its own place in the reading`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows([800, 2400, 400]),
            columnWidth: 800,
            viewportHeight: 200,
            topInset: 24,
        )
        let lane = Self.geometry(reading)
        #expect(lane.documentY(row: 0) == 0)
        #expect(lane.documentY(row: 1) == 800)
        #expect(lane.documentY(row: 2) == 3200)
        // The top gutter is scrollable too, so the first mark starts below it.
        #expect(lane.marks(in: 0 ... 600).map(\.y) == [3, 103, 403])
    }

    /// The cap takes lines off the FOOT of a block, so a huge row is drawn shorter rather than
    /// moved — which is what keeps its place, and every place after it, where the reading put it.
    @Test
    func `no single row may consume the overview in proportion to what it holds`() {
        let reading = MinimapReading(
            rows: [
                MinimapRow(height: 40, shape: .sentence(length: 40, ink: .command)),
                MinimapRow(height: 20000, shape: .prose(length: 40000, ink: .message)),
            ],
            columnWidth: 800,
            viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        #expect(lane.markHeight(row: 1) <= lane.markCeiling)
        #expect(lane.markHeight(row: 1) > lane.markCeiling - lane.lineSlot)
        #expect(lane.markY(row: 1) == 5)
    }

    @Test
    func `a row compressed below what can be seen is still drawn at one whole line`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows([4]), columnWidth: 800, viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        #expect(lane.marks(in: 0 ... 600)
            .map(\.height) == [lane.lineSlot - ArgoMinimapLane.markGap])
    }

    /// The whole reason #658 exists. At `feedAtScale`'s length the lane squeezed the whole session
    /// into its own height, every mark fell to the 1pt floor and the lane read as a texture. At the
    /// feed's own ratio a modest row is several points tall, whatever the length.
    @Test
    func `a session at a real length still has marks that can be told apart`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 40, count: 1031)),
            columnWidth: 620,
            viewportHeight: 600,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: 600))
        #expect(lane.lineSlot > ArgoMinimapLane.markMinimumHeight * 2)
        let head = lane.marks(in: 0 ... 600).map(\.height)
        #expect(head.allSatisfy { $0 > ArgoMinimapLane.markMinimumHeight })
    }

    /// A paragraph is one bar per measured line, laid down its own block. Any of them landing
    /// outside it would put a line of one row's prose over the row above or below it.
    @Test
    func `a row's lines are laid inside the block the row was given`() {
        let reading = MinimapReading(
            rows: [MinimapRow(height: 800, shape: .prose(length: 400, ink: .message))],
            columnWidth: 800,
            viewportHeight: 600,
        )
        let lane = Self.geometry(reading)
        let marks = lane.marks(in: 0 ... 600)
        #expect(!marks.isEmpty)
        #expect(marks.allSatisfy { $0.y >= 0 && $0.y + $0.height <= lane.markHeight(row: 0) })
    }

    /// Two rows of one line each must read as the same weight, whatever spacing the feed put around
    /// them — the padding buys the gap to the next row, exactly as it does in the reading.
    @Test
    func `two one-line rows are drawn the same height however they are spaced`() {
        let reading = MinimapReading(
            rows: [
                MinimapRow(height: 24, shape: .sentence(length: 40, ink: .command)),
                MinimapRow(height: 39, shape: .sentence(length: 40, ink: .command)),
            ],
            columnWidth: 800,
            viewportHeight: 600,
        )
        let heights = Self.geometry(reading).marks(in: 0 ... 600).map(\.height)
        #expect(heights.count == 2)
        #expect(heights[0] == heights[1])
    }
}
