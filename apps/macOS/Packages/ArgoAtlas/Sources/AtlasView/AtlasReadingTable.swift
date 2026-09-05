import ArgoDesign
import AtlasLayout
import SwiftUI

/// Every Measure the four plain facts and the gauge did not already state (#1154, the approved
/// design's `#read table`).
///
/// The Measure set is OPEN — it is a property of the repository and the languages in it — so this
/// is a list rather than a fixed set of rows, and a repository measuring six things draws six.
struct AtlasReadingTable: View {
    @Environment(\.argo) private var argo

    let rows: [AtlasMeasureRow]

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: ArgoSpacing.base, verticalSpacing: 0) {
            heading
            ForEach(rows, id: \.measure) { row in
                GridRow {
                    name(row)
                    value(row)
                }
                .padding(.vertical, ArgoSpacing.tight)
                .overlay(alignment: .bottom) { rule(argo.color.edge.hairline) }
            }
        }
    }

    private var heading: some View {
        GridRow {
            Text("Measure")
            Text("Value").frame(maxWidth: .infinity, alignment: .trailing)
        }
        .textCase(.uppercase)
        .argoText(ArgoTypography.machineCaption)
        .foregroundStyle(argo.color.text.tertiary)
        .padding(.bottom, ArgoSpacing.snug)
        .overlay(alignment: .bottom) { rule(argo.color.edge.subtle) }
    }

    /// The Measure's own name, marked where the map the reader is looking at is drawn by it. A
    /// reader comparing two numbers is owed the fact that one of them is the picture in front of
    /// them.
    private func name(_ row: AtlasMeasureRow) -> some View {
        HStack(spacing: ArgoSpacing.snug) {
            if row.isDrawn {
                Circle()
                    .fill(argo.color.interaction.accentBright)
                    .frame(width: AtlasTableMeasure.markSize, height: AtlasTableMeasure.markSize)
            }
            Text(row.measure)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .argoText(ArgoTypography.control)
        .foregroundStyle(ink(row))
    }

    /// The figure, in the machine face and flush right, because a column of numbers is compared
    /// down its own edge rather than read across.
    ///
    /// A Measure this file carries no value for says NOT MEASURED rather than zero (#1154). Zero
    /// is a measurement — the twenty PNGs in the committed fixture have no lines to count rather
    /// than none of them — and a row reading 0 says they were measured and found empty.
    private func value(_ row: AtlasMeasureRow) -> some View {
        Text(row.value.map { $0.formatted(.measured) } ?? "not measured")
            .argoText(row.value == nil ? ArgoTypography.caption : ArgoTypography.machine)
            .foregroundStyle(ink(row))
            .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// Three voices, which is three readings: the Measure driving the picture is the loudest, a
    /// Measure this file was never measured for is the quietest, and everything else sits between
    /// them.
    private func ink(_ row: AtlasMeasureRow) -> ArgoColor {
        if row.value == nil {
            return argo.color.text.disabled
        }
        return row.isDrawn ? argo.color.text.primary : argo.color.text.secondary
    }

    private func rule(_ ink: ArgoColor) -> some View {
        Rectangle().fill(ink).frame(height: ArgoStroke.hairline)
    }
}

/// The table's own two measures, beside the strip they describe.
enum AtlasTableMeasure {
    /// The mark against a Measure the map is drawn by — the design's own `●`, drawn rather than
    /// set, so it cannot come out at whatever size the reader's text is at. The contract's own
    /// filled disc, which is what every other mark of this shape in the app is drawn at.
    static let markSize = ArgoIconSize.statusDot
}
