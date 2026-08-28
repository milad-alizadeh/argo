import Foundation

/// Which rank each node stands at, and which edges had to be turned around to say so.
///
/// A flowchart is not always acyclic — `Read --> Write --> Read` is a source people really write —
/// and a ranking pass that meets a cycle either hangs or ranks for ever. So the cycle is BROKEN
/// first: a depth-first walk in the source's own order marks every edge that closes a loop, ranking
/// runs over what is left, and the marked edges are still drawn. Nothing is lost, and nothing
/// spins.
struct MermaidRanking: Equatable, Sendable {
    /// Each node's rank, deepest last. Every node the source named has one.
    let ranks: [String: Int]
    /// The edges the walk had to turn around, by their index in the chart's own list.
    let reversed: Set<Int>

    var depth: Int {
        (ranks.values.max() ?? 0) + 1
    }

    /// The nodes of each rank, in the order the source first named them.
    func rows(of names: [String]) -> [[String]] {
        (0 ..< depth).map { rank in names.filter { ranks[$0] == rank } }
    }
}

extension MermaidFlowchart {
    /// The chart ranked by longest path over its acyclic part.
    ///
    /// Longest path and not first arrival: a node is drawn under EVERY node that reaches it, so a
    /// diagram whose two branches rejoin joins them on one rank rather than leaving an arrow
    /// pointing back up the page.
    func ranking() -> MermaidRanking {
        let reversed = backEdges()
        var ranks = names.reduce(into: [String: Int]()) { $0[$1] = 0 }
        // Longest path over a DAG settles in at most one pass per node; the bound is what keeps a
        // chart this pass has misjudged from spinning rather than merely drawing oddly.
        for _ in names.indices {
            var settled = true
            for (at, edge) in edges.enumerated() where !reversed.contains(at) {
                let deeper = (ranks[edge.from] ?? 0) + 1
                guard deeper > ranks[edge.to] ?? 0 else { continue }
                ranks[edge.to] = deeper
                settled = false
            }
            if settled {
                break
            }
        }
        return MermaidRanking(ranks: ranks, reversed: reversed)
    }

    /// The edges that close a loop: those a depth-first walk meets pointing at a node already on
    /// its own stack. Walked in the source's order from every node in turn, so the same chart
    /// breaks at the same edges every run.
    private func backEdges() -> Set<Int> {
        var walk = MermaidCycleWalk(chart: self)
        for name in names {
            walk.visit(name)
        }
        return walk.reversed
    }
}
