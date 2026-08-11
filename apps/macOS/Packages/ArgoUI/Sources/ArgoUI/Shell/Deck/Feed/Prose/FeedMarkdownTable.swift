import SwiftUI

/// A pipe table, as a table.
///
/// A `Grid` and not a stack of rows: a column is only a column if every cell in it is the same
/// width, and the width that works is the widest cell's — which nothing knows until all of them
/// have been measured. The header is told apart by weight and a rule under it, never by a fill.
struct FeedMarkdownTable: View {
    @Environment(\.argo) private var argo

    let table: MarkdownTable

    var body: some View {
        // No spacing of its own in either axis: the gap between two cells is their padding, so a
        // rule drawn between two rows meets the border at both ends instead of stopping short.
        Grid(
            alignment: .topLeading,
            horizontalSpacing: ArgoSpacing.flush,
            verticalSpacing: ArgoSpacing.flush,
        ) {
            row(table.header, weight: .semibold)
            rule(argo.color.edge.subtle)
            ForEach(Array(table.rows.enumerated()), id: \.offset) { position, cells in
                if position > 0 {
                    rule(argo.color.edge.hairline)
                }
                row(cells, weight: nil)
            }
        }
        .clipShape(.rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.hairline)
        }
        // The border hugs the table and the table sits at the column's leading edge; stretching to
        // the measure would put the border out past the last column.
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// One row, with a rule standing between every pair of cells.
    ///
    /// The rules are grid CELLS of their own, interleaved into the row, which is what makes them
    /// line up down the table: a column of rules is a column like any other, so every row's rule
    /// sits at the same x whatever its cells wrapped to.
    private func row(_ cells: [String], weight: Font.Weight?) -> some View {
        GridRow {
            ForEach(interleaved(cells)) { slot in
                if let text = slot.text {
                    cell(text, weight: weight)
                } else {
                    // Drawn rather than a `Divider`, which reads its own axis from the stack it is
                    // in and has no stack here — inside a `GridRow` it came out horizontal, across
                    // the middle of a column it had also just made wide.
                    Rectangle()
                        .fill(argo.color.edge.hairline)
                        .frame(width: ArgoFeedRow.ruleWidth)
                        .frame(maxHeight: .infinity)
                        // The rule stretches to the row, but must never ASK for a height: a
                        // flexible grid cell takes the whole vertical proposal, and the feed
                        // measures rows with an unbounded one.
                        .gridCellUnsizedAxes(.vertical)
                }
            }
        }
    }

    /// The cells with a rule between each pair — `nil` text is a rule, and there is never one at
    /// either end because the border is already there.
    private func interleaved(_ cells: [String]) -> [TableSlot] {
        cells.enumerated().flatMap { position, text in
            let rule = TableSlot(id: position * 2, text: nil)
            let cell = TableSlot(id: position * 2 + 1, text: text)
            return position == 0 ? [cell] : [rule, cell]
        }
    }

    /// The header's rule is the stronger one; between two body rows a hairline is enough.
    private func rule(_ ink: ArgoColor) -> some View {
        Divider()
            .overlay(ink)
            .gridCellUnsizedAxes(.horizontal)
    }

    /// A cell wraps rather than truncating, and asks for no more width than its words need — a
    /// `Grid` column is as wide as its widest cell wants to be, and the rest goes to the column
    /// that can use it.
    private func cell(_ text: String, weight: Font.Weight?) -> some View {
        FeedProseText(text: text, rung: ArgoFeedRow.proseRung, weight: weight)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.snug)
    }
}

/// A place in a row: a cell's words, or the rule that stands between two of them.
private struct TableSlot: Identifiable {
    let id: Int
    let text: String?
}

#Preview("Feed table — a cell that wraps beside three that do not") {
    FeedMarkdown(text: """
    | Rule | Where it is spelled |
    |---|---|
    | Every visual constant is a token, so no view spells a number of its own | `ArgoFeedRow` |
    | A column is as wide as its widest cell wants to be | `FeedMarkdownTable` |
    """)
    .padding(ArgoFeedRow.inset)
    .frame(width: 460)
    .argoDeckSurface()
    .argoAppearance()
}
