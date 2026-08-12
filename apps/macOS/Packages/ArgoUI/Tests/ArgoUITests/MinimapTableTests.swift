@testable import ArgoUI
import Foundation
import Testing

/// A pipe table in the lane, drawn as its cells rather than as one box. A single frame said "a
/// table
/// stood here"; the cells say which of the columns the reader is looking for is which.
@Suite("Minimap table cells")
struct MinimapTableTests {
    private static let measure: CGFloat = 720

    /// Two rows of three cells: `| a | b | c |` with a header over it.
    private static func table(_ cells: [[Int]]) -> MinimapProseBlock {
        MinimapProseBlock(
            kind: .table, length: cells.joined().reduce(0, +), sourceLines: cells.count,
            cells: cells,
        )
    }

    private static func runs(_ cells: [[Int]], over share: Int) -> [MinimapRun] {
        MinimapRuns.cells(of: table(cells), from: 0, over: share, across: measure)
    }

    @Test
    func `every cell is drawn, in the table's own ink`() {
        let runs = Self.runs([[4, 4, 4], [4, 4, 4]], over: 4)
        #expect(runs.count == 6)
        #expect(runs.allSatisfy { $0.ink == .table })
    }

    /// A column as wide as its words: the same rule `MarkdownTableWidths` gives the feed, so the
    /// grid in the lane and the grid in the reading have the same shape.
    @Test
    func `a column of long cells is drawn wider than a column of short ones`() {
        let runs = Self.runs([[2, 60], [2, 60]], over: 2)
        let first = runs[0]
        let second = runs[1]
        #expect(Self.width(second) > Self.width(first) * 3)
    }

    /// The cells tile the width and stand in the order they are read.
    @Test
    func `the cells of one row meet edge to edge across the whole width`() {
        let runs = Self.runs([[10, 20, 30]], over: 1)
        #expect(runs[0].span.lowerBound == 0)
        #expect(runs[2].span.upperBound == 1)
        #expect(abs(runs[0].span.upperBound - runs[1].span.lowerBound) < 0.0001)
        #expect(abs(runs[1].span.upperBound - runs[2].span.lowerBound) < 0.0001)
    }

    /// A row whose cell wraps stands taller, exactly as it does in the feed.
    @Test
    func `a row holding a long cell is dealt more lines than a short one`() {
        let runs = Self.runs([[4, 4], [4, 900]], over: 8)
        let header = runs.filter { $0.line == 0 }
        #expect(!header.isEmpty)
        #expect(header[0].lines < runs.last?.lines ?? 0)
    }

    /// Below one line per row the grid cannot be resolved, and a grid nobody can resolve reads as
    /// noise where the single box read as a table.
    @Test
    func `a table the lane compressed falls back to one frame`() {
        let runs = Self.runs([[4, 4], [4, 4], [4, 4]], over: 2)
        #expect(runs.count == 1)
        #expect(runs[0].span == 0 ... 1)
        #expect(runs[0].lines == 2)
    }

    /// The cells come off the row's markdown, so a table read out of a message carries them.
    @Test @MainActor
    func `a table read from markdown carries its cells`() {
        let text = "| a | b |\n|---|---|\n| 1 | 2 |"
        let blocks = MinimapProseBlock.blocks(from: MarkdownBlock.blocks(in: text))
        #expect(blocks.map(\.kind) == [.table])
        #expect(blocks[0].cells == [[1, 1], [1, 1]])
    }

    /// A table nothing could read cells out of still draws the box it always did.
    @Test
    func `a table with no cells is one frame`() {
        let runs = Self.runs([], over: 4)
        #expect(runs.count == 1)
    }
}

private extension MinimapTableTests {
    static func width(_ run: MinimapRun) -> CGFloat {
        run.span.upperBound - run.span.lowerBound
    }
}
