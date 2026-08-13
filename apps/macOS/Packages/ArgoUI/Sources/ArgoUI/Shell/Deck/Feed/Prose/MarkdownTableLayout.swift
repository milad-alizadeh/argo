import SwiftUI

/// A pipe table's own layout: the columns' widths decided from the proposal the table is actually
/// given, then every cell placed on them and every row given its tallest cell's height.
///
/// A `Layout` and not a `Grid` for one reason: the widths are a function of the PROPOSAL, and a
/// `Grid` never tells its cells what room there is. A width learned through `@State` instead would
/// arrive one frame after the feed had already measured the row and cached its height, so the row
/// would keep the height of a layout nobody ever saw.
///
/// Both answers come from `MarkdownTable` rather than from the subviews. The overview lane maps
/// this grid, and it can only do that on the same numbers — a layout that asked its cells and a
/// lane that worked them out are two answers, which is exactly how the map came to draw a different
/// table.
///
/// Subviews arrive row-major, header row first, `columns` of them per row.
struct MarkdownTableLayout: Layout {
    let table: MarkdownTable

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews _: Subviews,
        cache _: inout (),
    )
        -> CGSize {
        // SwiftUI runs layout on the main actor, but `Layout` itself makes no such claim — and the
        // measurements below are the main actor's cache. Asserting it is what lets ONE answer serve
        // the drawn table and the lane that maps it.
        MainActor.assumeIsolated {
            let widths = table.widths(across: proposal.width)
            return CGSize(
                width: widths.reduce(0, +),
                height: table.heights(on: widths).reduce(0, +),
            )
        }
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    ) {
        MainActor.assumeIsolated {
            let widths = table.widths(across: proposal.width)
            var y = bounds.minY
            for (row, height) in table.heights(on: widths).enumerated() {
                let band = CGRect(x: bounds.minX, y: y, width: bounds.width, height: height)
                place(row: row, of: subviews, on: widths, in: band)
                y += height
            }
        }
    }

    /// One row of cells, placed across the widths its columns were dealt. Every cell takes the
    /// band's full height, which is what lines the rules up across the table for free.
    private func place(row: Int, of subviews: Subviews, on widths: [CGFloat], in band: CGRect) {
        var x = band.minX
        for column in widths.indices {
            defer { x += widths[column] }
            guard let cell = at(row: row, column: column, in: subviews) else { continue }
            cell.place(
                at: CGPoint(x: x, y: band.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: widths[column], height: band.height),
            )
        }
    }

    /// The cell at a place in the grid, or `nil` where the rows ran out — a table whose last row is
    /// short is the agent's, and the gap is drawn rather than trapped on.
    private func at(row: Int, column: Int, in subviews: Subviews) -> Subviews.Element? {
        let at = row * table.columns + column
        return subviews.indices.contains(at) ? subviews[at] : nil
    }
}
