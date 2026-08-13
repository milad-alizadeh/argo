import Foundation

// A pipe table's geometry: what its columns ask for, what they are dealt, and how tall each row
// comes out. ONE answer, used by the layout that places the real cells and by the lane that maps
// them — two answers is how the lane came to draw a table's grid at a different shape from the
// table.

extension MarkdownTable {
    /// Every row of cells, header first — the shape the table is actually drawn in.
    var grid: [[String]] {
        [header] + rows
    }

    var columns: Int {
        max(1, header.count)
    }

    /// One cell of a row, or the empty string where a short row ran out. A ragged row is the
    /// agent's, and the gap is drawn rather than trapped on.
    func cell(of row: [String], at column: Int) -> String {
        row.indices.contains(column) ? row[column] : ""
    }
}

@MainActor
extension MarkdownTable {
    /// What each column asks for: its widest cell's words on one line, and the floor its longest
    /// word cannot be broken below. Both measured — see `ProseMetrics` — because a column's width
    /// is a question about glyphs, and a count of characters answers it within a third at best.
    var asks: [MarkdownTableWidths.Ask] {
        (0 ..< header.count).map { column in
            let body = rows.map { cell(of: $0, at: column) }
            let padding = ArgoFeedRow.tableCellInsetX * 2
            return MarkdownTableWidths.Ask(
                ideal: padding + max(
                    ProseMetrics.width(of: header[column], in: .header),
                    body.map { ProseMetrics.width(of: $0) }.max() ?? 0,
                ),
                floor: padding + max(
                    ProseMetrics.word(in: header[column], face: .header),
                    body.map { ProseMetrics.word(in: $0) }.max() ?? 0,
                ),
            )
        }
    }

    /// The columns' drawn widths across a measure. An unspecified one — which is what a row is
    /// measured against before it has a width — falls back to what the columns asked for.
    func widths(across measure: CGFloat?) -> [CGFloat] {
        guard !header.isEmpty else { return [] }
        let asks = asks
        return MarkdownTableWidths.widths(asks, across: measure ?? asks.map(\.ideal).reduce(0, +))
    }

    /// Every row's height: its tallest cell's words at the width that cell is drawn at, plus the
    /// cell's own breathing room above and below.
    func heights(on widths: [CGFloat]) -> [CGFloat] {
        guard !widths.isEmpty else { return [] }
        return grid.enumerated().map { at, row in
            let face: ProseFace = at == 0 ? .header : .body
            let lines = widths.indices.reduce(1) { tallest, column in
                let inside = widths[column] - ArgoFeedRow.tableCellInsetX * 2
                let lay = ProseMetrics.lay(out: cell(of: row, at: column), across: inside, in: face)
                return max(tallest, lay.lines)
            }
            return face.height(ofLines: lines) + ArgoFeedRow.tableCellInsetY * 2
        }
    }
}
