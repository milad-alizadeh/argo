import Foundation

// A pipe table as the lane draws it: its cells, in the proportions the feed gives them.
//
// The columns are dealt the way `MarkdownTableWidths` deals the feed's own — by what each column's
// widest cell asks for — off the cells' character counts rather than their measured glyphs. A count
// is within a few percent of a measure at this scale, and it costs no font: the lane draws a grid
// here, never the words inside it.

extension MinimapRuns {
    /// A table's cells, stroked.
    ///
    /// One frame for the whole block where the lane has fewer lines than the table has rows: below
    /// that a row band is thinner than the floor under a mark, and a grid nobody can resolve reads
    /// as noise where the single box read as a table.
    static func cells(
        of block: MinimapProseBlock,
        from cursor: Int,
        over share: Int,
        across measure: CGFloat,
    )
        -> [MinimapRun] {
        let cells = block.cells
        guard let columns = cells.first?.count, columns > 0, share >= cells.count else {
            return [MinimapRun(ink: .table, line: cursor, lines: share, span: span(0, 1))]
        }
        let widths = columnShares(of: cells, over: columns)
        let bands = shares(of: share, by: rowWeights(of: cells, on: widths, across: measure))
        var runs: [MinimapRun] = []
        var line = cursor
        for band in bands where band > 0 {
            var head: CGFloat = 0
            for width in widths {
                runs.append(
                    MinimapRun(
                        ink: .table,
                        line: line,
                        lines: band,
                        span: span(head, head + width),
                    ),
                )
                head += width
            }
            line += band
        }
        return runs
    }

    /// Each column as a share of the table's width: what its widest cell asks for, padding and all,
    /// against what every column asks for together.
    private static func columnShares(of cells: [[Int]], over columns: Int) -> [CGFloat] {
        let asks = (0 ..< columns).map { column in
            let widest = cells.reduce(0) { widest, row in
                max(widest, row.indices.contains(column) ? row[column] : 0)
            }
            return CGFloat(widest) + cellPadding
        }
        let total = asks.reduce(0, +)
        guard total > 0 else { return asks.map { _ in 1 / CGFloat(columns) } }
        return asks.map { $0 / total }
    }

    /// How many lines each row of the table stands: its tallest cell's, at the width that cell was
    /// dealt. The same question the feed's own layout asks, in characters instead of points.
    private static func rowWeights(
        of cells: [[Int]],
        on widths: [CGFloat],
        across measure: CGFloat,
    )
        -> [Int] {
        let perLine = CGFloat(charactersPerLine(across: measure))
        return cells.map { row in
            row.indices.reduce(1) { tallest, column in
                let held = max(1, (widths[column] * perLine) - cellPadding)
                return max(tallest, Int((CGFloat(row[column]) / held).rounded(.up)))
            }
        }
    }

    /// One cell's padding as a count of characters, so a column's ask adds up in one unit.
    private static var cellPadding: CGFloat {
        ArgoFeedRow.tableCellInsetX * 2
            / (ArgoFeedRow.proseRung.size * ArgoMinimapLane.characterAdvanceShare)
    }
}
