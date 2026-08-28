import Foundation

/// A pie chart as its source wrote it: what it is called, whether it shows its numbers, and the
/// slices in the order they were written.
///
/// The VALUES are held and never the shares. Mermaid never asked a source to sum to a hundred, so
/// normalising is arithmetic the chart does rather than a fact the source stated — and a model
/// holding the shares could not answer what `showData` writes.
struct MermaidPie: Equatable, Sendable {
    /// What the chart is called. Empty where the source named it nothing, so an absent title is a
    /// caption that is not placed rather than an optional threaded through the layout.
    var title = ""
    /// `showData` — the value the source wrote, beside the share the chart worked out.
    var showsData = false
    var slices: [Slice] = []

    struct Slice: Equatable, Sendable {
        let label: String
        /// Never negative: the reader refuses a row it cannot draw a wedge for.
        let value: Double
    }

    var total: Double {
        slices.reduce(0) { $0 + $1.value }
    }

    /// Each slice's share of the whole, in written order.
    ///
    /// A total of nothing shares nothing — which is what keeps a chart of zeroes from dividing by
    /// it, and is the honest answer either way: eight equal wedges invented to fill the circle
    /// would be a reading the source never gave.
    var shares: [Double] {
        let whole = total
        guard whole > 0 else { return slices.map { _ in 0 } }
        return slices.map { $0.value / whole }
    }

    /// What the legend writes beside each name: the share always, and the value the source wrote
    /// where `showData` asked for it.
    ///
    /// One rule, so the labels the view builds and the captions the layout places cannot say two
    /// different things.
    var readings: [String] {
        zip(slices, shares).map { slice, share in
            let percent = "\(Int((share * 100).rounded()))%"
            return showsData ? "\(Self.number(slice.value)) · \(percent)" : percent
        }
    }

    /// The chart's own name, at the loudest face a diagram sets — or nothing, where it has none.
    var titleLabel: MermaidLabel? {
        title.isEmpty
            ? nil
            : MermaidLabel(text: title, face: MermaidMeasure.titleFace, role: .note)
    }

    /// One label per caption the plan places, in that order: the title, then every name, then
    /// every reading.
    ///
    /// The view builds one `Text` from each of these before SwiftUI has told it a measure, so this
    /// order is a contract between the model and `laid` rather than an incidental.
    var labels: [MermaidLabel] {
        let aside = MermaidMeasure.edgeFace
        return (titleLabel.map { [$0] } ?? [])
            + slices.map { MermaidLabel(text: $0.label, face: aside) }
            + readings.map { MermaidLabel(text: $0, face: aside, role: .note) }
    }

    /// A value as the source would have written it — no trailing zeros on a whole number, and the
    /// decimals kept on one that has them.
    private static func number(_ value: Double) -> String {
        String(format: "%g", value)
    }
}
