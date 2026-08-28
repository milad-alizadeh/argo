import Foundation

/// How far a rank reaches on each axis, and the gaps it keeps. A value rather than four parameters
/// threaded through the pass that uses them.
struct MermaidRanks {
    /// Every node's measured box, by name. A dictionary and not a scan of the graph: this is asked
    /// once per node per rank, on every rank, and a linear lookup makes that quadratic.
    private let sizes: [String: CGSize]
    /// A grain with no depth, used only to ask which way a size is measured — the real one is not
    /// known until every rank has been measured with this.
    let flat: MermaidGrain
    /// The extra room every gap gives an enclosure to close around its members without shutting
    /// over the node next door. Zero for a graph with no enclosure in it.
    let inset: CGFloat
    /// The room the graph itself asked its lane for — see `MermaidGraph.lane`.
    private let lane: CGFloat

    init(graph: MermaidGraph) {
        self.sizes = Dictionary(
            graph.nodes.map { ($0.name, $0.size) },
            uniquingKeysWith: { first, _ in first },
        )
        self.flat = MermaidGrain(direction: graph.direction, depth: 0)
        self.inset = graph.groups.isEmpty ? 0 : MermaidMeasure.groupInset * 2
        self.lane = graph.lane
    }

    var rankStep: CGFloat {
        MermaidMeasure.rankGap + inset + lane
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
