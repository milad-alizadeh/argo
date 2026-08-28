import Foundation

/// How far a rank reaches on each axis, and the gaps it keeps. A value rather than four parameters
/// threaded through the pass that uses them.
struct MermaidRanks {
    let graph: MermaidGraph
    /// An axis with no depth, used only to ask which way a size is measured — the real one is not
    /// known until every rank has been measured with this.
    let flat: MermaidAxis
    /// The extra room every gap gives an enclosure to close around its members without shutting
    /// over the node next door. Zero for a graph with no enclosure in it.
    let inset: CGFloat

    init(graph: MermaidGraph) {
        self.graph = graph
        self.flat = MermaidAxis(direction: graph.direction, depth: 0)
        self.inset = graph.groups.isEmpty ? 0 : MermaidMeasure.groupInset * 2
    }

    var rankStep: CGFloat {
        MermaidMeasure.rankGap + inset
    }

    var nodeStep: CGFloat {
        MermaidMeasure.nodeGap + inset
    }

    func size(of name: String) -> CGSize {
        graph.size(of: name)
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
