@testable import ArgoUI
import Foundation
import Testing

/// A pipe table in the lane, drawn as its cells rather than as one box — on the very widths and
/// heights `MarkdownTableLayout` places the real cells at.
///
/// One answer for both, which is the point of the suite. The lane used to work the grid out for
/// itself from character counts, and a grid worked out twice is two grids.
@MainActor
@Suite("Minimap table cells")
struct MinimapTableTests {
    private static let measure: CGFloat = 720 - ArgoFeedRow.inset * 2

    private static func table(_ header: [String], _ rows: [[String]]) -> MarkdownTable {
        MarkdownTable(header: header, rows: rows)
    }

    private static func marks(_ header: [String], _ rows: [[String]]) -> [MinimapRowMark] {
        table(header, rows).laid(across: measure).marks
    }

    @Test
    func `every cell is drawn, in the table's own ink`() {
        let marks = Self.marks(["a", "b", "c"], [["1", "2", "3"]])
        #expect(marks.count == 6)
        #expect(marks.allSatisfy { $0.ink == .table })
        #expect(marks.allSatisfy { $0.drawn == .frame })
    }

    /// A column as wide as its words: the same rule `MarkdownTableWidths` gives the feed, so the
    /// grid in the lane and the grid in the reading have the same shape.
    @Test
    func `a column of long cells is drawn wider than a column of short ones`() {
        let marks = Self.marks(["a", "b"], [["1", "a much longer cell than its neighbour"]])
        #expect(Self.width(marks[1]) > Self.width(marks[0]) * 3)
    }

    /// The cells tile the measure and stand in the order they are read. A gap between two of them
    /// reads as two tables where the feed draws one.
    @Test
    func `the cells of one row meet edge to edge across the whole measure`() {
        let marks = Self.marks(["one", "two", "three"], [])
        #expect(marks[0].from == 0)
        #expect(abs(marks[2].to - Self.measure) < 0.0001)
        #expect(abs(marks[0].to - marks[1].from) < 0.0001)
        #expect(abs(marks[1].to - marks[2].from) < 0.0001)
    }

    /// A row whose cell wraps stands taller, exactly as it does in the feed — and the row under it
    /// starts where it ends.
    @Test
    func `a row holding a cell that wraps stands taller than one that does not`() {
        let long = String(repeating: "words that will have to wrap somewhere ", count: 4)
        let marks = Self.marks(["a", "b"], [["1", long], ["2", "3"]])
        let rows = Dictionary(grouping: marks, by: \.y).sorted { $0.key < $1.key }
        #expect(rows.count == 3)
        #expect(rows[1].value[0].height > rows[0].value[0].height)
        #expect(rows[2].key == rows[1].key + rows[1].value[0].height)
    }

    /// Every cell of a row is drawn at that row's full height, so the grid lines up across the
    /// table whatever its neighbour wrapped to.
    @Test
    func `every cell of a row stands at the row's own height`() {
        let long = String(repeating: "wrapping words ", count: 6)
        let marks = Self.marks(["a", "b"], [["1", long]])
        let body = marks.filter { $0.y > 0 }
        #expect(body.count == 2)
        #expect(body[0].height == body[1].height)
    }

    /// A table with nothing in it draws nothing rather than a box claiming a table stood there.
    @Test
    func `a table with no columns draws nothing`() {
        #expect(Self.marks([], []).isEmpty)
    }

    /// The block comes off the row's markdown carrying the table itself, so the lane deals its
    /// columns through the feed's own function rather than through a reduction of it.
    @Test
    func `a table read from markdown carries the table itself`() {
        let text = "| a | b |\n|---|---|\n| 1 | 2 |"
        let blocks = MinimapProseBlock.blocks(from: MarkdownBlock.blocks(in: text))
        #expect(blocks == [.table(MarkdownTable(header: ["a", "b"], rows: [["1", "2"]]))])
    }
}

private extension MinimapTableTests {
    static func width(_ mark: MinimapRowMark) -> CGFloat {
        mark.to - mark.from
    }
}
