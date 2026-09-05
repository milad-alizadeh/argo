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

    /// Rows rather than a `Grid`, because the rule under each one has to run the WHOLE width. A
    /// grid draws a cell's background per cell, so the same rule comes out as two ragged segments
    /// with a gap between the columns — and the gap wanders with the label's own width, which
    /// reads as an artifact rather than as a rule.
    ///
    /// The value still lands on one edge without a shared column: it is pushed to the trailing
    /// edge of the row, which is where the design puts it (`#read td.v { text-align: right }`).
    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            heading
            ForEach(rows, id: \.measure) { row in
                HStack(spacing: ArgoSpacing.base) {
                    name(row)
                    value(row)
                }
                .padding(.vertical, ArgoSpacing.tight)
                .overlay(alignment: .bottom) { rule(argo.color.edge.hairline) }
            }
        }
    }

    private var heading: some View {
        HStack(spacing: ArgoSpacing.base) {
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
        .foregroundStyle(row.value == nil ? argo.color.text.disabled : nameInk(row))
    }

    /// The figure, in the machine face and flush right, because a column of numbers is compared
    /// down its own edge rather than read across.
    ///
    /// A Measure this file carries no value for says NOT MEASURED rather than zero (#1154). Zero
    /// is a measurement — the twenty PNGs in the committed fixture have no lines to count rather
    /// than none of them — and a row reading 0 says they were measured and found empty.
    private func value(_ row: AtlasMeasureRow) -> some View {
        Text(row.value.map { $0.formatted(.measured) } ?? AtlasUnmeasured.alone)
            .argoText(row.value == nil ? ArgoTypography.caption : ArgoTypography.machine)
            .foregroundStyle(row.value == nil ? argo.color.text.disabled : valueInk)
            .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// The Measure's NAME is the quiet half of the row — the design's `#read td`, a step under the
    /// figure beside it, because a column of names is scanned and a column of figures is read.
    private func nameInk(_ row: AtlasMeasureRow) -> ArgoColor {
        row.isDrawn ? argo.color.text.primary : argo.color.text.secondary
    }

    /// The FIGURE is the loud half, at full strength whether the map is drawn by it or not — the
    /// design's `#read td.v`, where only an unmeasured row dims. A figure a step quieter than the
    /// name beside it would read as provisional, and every one of these is a measurement.
    private var valueInk: ArgoColor {
        argo.color.text.primary
    }

    /// A border's WIDTH in a hairline's colour, which is what the design draws: the quiet ink says
    /// these are rows of one table, and the full rung is what keeps the rule visible at all under
    /// a column of figures.
    private func rule(_ ink: ArgoColor) -> some View {
        Rectangle().fill(ink).frame(height: ArgoStroke.border)
    }
}

/// The table's own two measures, beside the strip they describe.
enum AtlasTableMeasure {
    /// The mark against a Measure the map is drawn by — the design's own `●`, drawn rather than
    /// set, so it cannot come out at whatever size the reader's text is at. The contract's own
    /// filled disc, which is what every other mark of this shape in the app is drawn at.
    static let markSize = ArgoIconSize.statusDot
}
