import SwiftUI

/// A pipe table's own layout: the columns' widths decided from the proposal the table is actually
/// given, then every cell placed on them and every row given its tallest cell's height.
///
/// A `Layout` and not a `Grid` for one reason: the widths are a function of the PROPOSAL, and a
/// `Grid` never tells its cells what room there is. A width learned through `@State` instead would
/// arrive one frame after the feed had already measured the row and cached its height, so the row
/// would keep the height of a layout nobody ever saw.
///
/// Subviews arrive row-major, header row first, `columns` of them per row.
struct MarkdownTableLayout: Layout {
    /// What each column asks for, in the order they are drawn.
    let asks: [MarkdownTableWidths.Ask]

    var columns: Int {
        asks.count
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    )
        -> CGSize {
        let widths = widths(across: proposal.width, subviews: subviews)
        let heights = heights(subviews, on: widths)
        return CGSize(width: widths.reduce(0, +), height: heights.reduce(0, +))
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout (),
    ) {
        let widths = widths(across: proposal.width, subviews: subviews)
        let heights = heights(subviews, on: widths)
        var y = bounds.minY
        for (row, height) in heights.enumerated() {
            var x = bounds.minX
            for column in 0 ..< columns {
                guard let cell = at(row: row, column: column, in: subviews) else { continue }
                cell.place(
                    at: CGPoint(x: x, y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(width: widths[column], height: height),
                )
                x += widths[column]
            }
            y += height
        }
    }

    /// The columns' widths at this proposal. An unspecified width — which is what a row is measured
    /// against before it has one — falls back to what the columns asked for.
    private func widths(across proposal: CGFloat?, subviews: Subviews) -> [CGFloat] {
        guard columns > 0, !subviews.isEmpty else { return [] }
        let measure = proposal ?? asks.map(\.ideal).reduce(0, +)
        return MarkdownTableWidths.widths(asks, across: measure)
    }

    /// Every row's height: its tallest cell's, asked at the width that cell will be drawn at.
    private func heights(_ subviews: Subviews, on widths: [CGFloat]) -> [CGFloat] {
        guard !widths.isEmpty else { return [] }
        let rows = (subviews.count + columns - 1) / columns
        return (0 ..< rows).map { row in
            (0 ..< columns).reduce(CGFloat.zero) { tallest, column in
                guard let cell = at(row: row, column: column, in: subviews) else { return tallest }
                let fits = cell.sizeThatFits(
                    ProposedViewSize(width: widths[column], height: nil),
                )
                return max(tallest, fits.height)
            }
        }
    }

    /// The cell at a place in the grid, or `nil` where the rows ran out — a table whose last row is
    /// short is the agent's, and the gap is drawn rather than trapped on.
    private func at(row: Int, column: Int, in subviews: Subviews) -> Subviews.Element? {
        let at = row * columns + column
        return subviews.indices.contains(at) ? subviews[at] : nil
    }
}
