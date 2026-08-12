import SwiftUI

/// A pipe table, as a table — across the whole measure the feed gives it.
///
/// The columns divide that measure in proportion to what their words ask for, which is
/// `MarkdownTableWidths` through `MarkdownTableLayout`; a `Grid` sized itself instead, and past the
/// measure it shrank every column to its longest word and left the table a third of the feed wide.
/// The header is told apart by weight and a stronger rule under it, never by a fill.
struct FeedMarkdownTable: View {
    @Environment(\.argo) private var argo

    let table: MarkdownTable

    var body: some View {
        MarkdownTableLayout(asks: table.asks) {
            ForEach(0 ..< places, id: \.self) { place in
                cell(row: place / columns, column: place % columns)
            }
        }
        .clipShape(.rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.hairline)
        }
    }

    private var columns: Int {
        max(1, table.header.count)
    }

    /// How many cells there are — the header row and the body, rules excluded.
    private var places: Int {
        (table.rows.count + 1) * columns
    }

    private func text(row: Int, column: Int) -> String {
        let cells = row == 0 ? table.header : table.rows[row - 1]
        return cells.indices.contains(column) ? cells[column] : ""
    }

    /// One cell, carrying the two rules that stand at its own edges.
    ///
    /// The rules are drawn ON the cell rather than between cells, so they line up down and across
    /// the table for free: every cell in a row is placed at that row's full height, so a leading
    /// rule spans the row whatever its neighbour wrapped to.
    private func cell(row: Int, column: Int) -> some View {
        FeedProseText(
            text: text(row: row, column: column),
            rung: ArgoFeedRow.proseRung,
            weight: row == 0 ? .semibold : nil,
        )
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, ArgoFeedRow.tableCellInsetX)
        .padding(.vertical, ArgoFeedRow.tableCellInsetY)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .top) {
            // Under the header the rule is the stronger one; between two body rows a hairline does.
            if row > 0 {
                rule(row == 1 ? argo.color.edge.subtle : argo.color.edge.hairline)
                    .frame(height: ArgoFeedRow.ruleWidth)
            }
        }
        .overlay(alignment: .leading) {
            if column > 0 {
                rule(argo.color.edge.hairline).frame(width: ArgoFeedRow.ruleWidth)
            }
        }
    }

    /// Drawn rather than a `Divider`, which reads its axis from the stack it is in and has none
    /// here — as an overlay it came out horizontal across a column it had also just made wide.
    private func rule(_ ink: ArgoColor) -> some View {
        Rectangle().fill(ink)
    }
}

@MainActor
extension MarkdownTable {
    /// What each column asks for: its widest cell's words on one line, and the floor its longest
    /// word cannot be broken below. Both measured — see `ProseMetrics` — because a column's width
    /// is a question about glyphs, and a count of characters answers it within a third at best.
    var asks: [MarkdownTableWidths.Ask] {
        (0 ..< header.count).map { column in
            let cells = rows.map { $0.indices.contains(column) ? $0[column] : "" }
            let padding = ArgoFeedRow.tableCellInsetX * 2
            return MarkdownTableWidths.Ask(
                ideal: padding + max(
                    ProseMetrics.width(of: header[column], header: true),
                    cells.map { ProseMetrics.width(of: $0) }.max() ?? 0,
                ),
                floor: padding + max(
                    ProseMetrics.word(in: header[column], header: true),
                    cells.map { ProseMetrics.word(in: $0) }.max() ?? 0,
                ),
            )
        }
    }
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
