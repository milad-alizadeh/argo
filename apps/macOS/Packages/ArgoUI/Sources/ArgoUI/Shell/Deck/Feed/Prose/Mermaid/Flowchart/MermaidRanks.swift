import Foundation

/// How far a rank reaches on each axis, and the gaps it keeps. A value rather than four parameters
/// threaded through the pass that uses them.
@MainActor
struct MermaidRanks {
    let sizes: [String: CGSize]
    /// An axis with no depth, used only to ask which way a size is measured — the real one is not
    /// known until every rank has been measured with this.
    let flat: MermaidAxis
    /// The extra room every gap gives an enclosure to close around its members without shutting
    /// over the node next door. Zero for a chart with no `subgraph` in it.
    let inset: CGFloat

    init(chart: MermaidFlowchart) {
        self.sizes = chart.nodes.reduce(into: [String: CGSize]()) {
            $0[$1.name] = MermaidPlacement.box(of: $1)
        }
        self.flat = MermaidAxis(direction: chart.direction, depth: 0)
        self.inset = chart.groups.isEmpty ? 0 : MermaidMeasure.groupInset * 2
    }

    var rankStep: CGFloat {
        MermaidMeasure.rankGap + inset
    }

    var nodeStep: CGFloat {
        MermaidMeasure.nodeGap + inset
    }

    func size(of name: String) -> CGSize {
        sizes[name] ?? .zero
    }

    /// How deep into the ranks one rank reaches: its tallest box.
    func along(of row: [String]) -> CGFloat {
        row.map { flat.along(of: size(of: $0)) }.max() ?? 0
    }

    /// How far one rank reaches across: its boxes and the gaps between them.
    func across(of row: [String]) -> CGFloat {
        row.map { flat.across(of: size(of: $0)) }.reduce(0, +)
            + nodeStep * CGFloat(max(0, row.count - 1))
    }
}
