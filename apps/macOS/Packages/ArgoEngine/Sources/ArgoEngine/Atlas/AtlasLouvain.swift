/// Communities by modularity, at a resolution the caller chooses (#1157).
///
/// Louvain: move every node to whichever neighbouring community gains the most modularity, then
/// collapse each community to one node and do it again, until a round merges nothing. The
/// resolution is the knob `AtlasPlateau` turns — above 1 it prefers many small communities, below
/// it few large ones — and the whole reason it is a parameter is that the right value is a
/// property of the repository rather than of this algorithm.
enum AtlasLouvain {
    /// How many times the graph may be collapsed. A bound on a loop that ends on its own: it is
    /// there so a pathological graph cannot hold a measurement open, and no repository measured
    /// here has reached it.
    static let rounds = 12

    /// Which community each node belongs to, by position. The ids are the communities of the last
    /// collapsed level, so they are labels rather than numbers — nothing downstream reads one as
    /// anything but "the same as" or "different from".
    static func communities(of graph: AtlasGraph, resolution: Double) -> [Int] {
        var level = graph
        var belonging = Array(0 ..< graph.count)
        for _ in 0 ..< rounds {
            let moved = AtlasLocalMove(graph: level, resolution: resolution).settled()
            var dense: [Int: Int] = [:]
            for community in moved where dense[community] == nil {
                dense[community] = dense.count
            }
            // Nothing merged, so collapsing would hand the next round the same graph back.
            guard dense.count < level.count else { break }
            belonging = belonging.map { dense[moved[$0]] ?? 0 }
            level = collapsed(level, into: moved, numbered: dense)
        }
        return belonging
    }

    /// The graph with each community collapsed to one node. An edge inside a community becomes a
    /// self-loop carrying its weight, so the next round's modularity still counts what it holds.
    private static func collapsed(
        _ graph: AtlasGraph,
        into moved: [Int],
        numbered dense: [Int: Int],
    )
        -> AtlasGraph {
        var weights: [AtlasPair: Double] = [:]
        for (pair, weight) in graph.weights {
            let first = dense[moved[pair.first]] ?? 0
            let second = dense[moved[pair.second]] ?? 0
            weights[AtlasPair(first, second), default: 0] += weight
        }
        return AtlasGraph(count: dense.count, weights: weights)
    }
}

/// One level of the optimisation: every node starts in a community of its own and takes the
/// neighbouring community it gains most by joining, over and over until nothing moves.
private struct AtlasLocalMove {
    /// How many passes over every node one level may take. The same kind of bound as `rounds`,
    /// and reached by nothing measured here.
    static let passes = 20

    /// A gain has to beat the standing one by more than this to be taken. Doubles do not add
    /// associatively, so two communities pulling equally on one file differ in the last bits, and
    /// without the margin the winner would depend on which order the sums happened to be made in.
    static let decisive = 0.000_000_000_001

    let graph: AtlasGraph
    let resolution: Double

    /// The communities once no node moves any more.
    func settled() -> [Int] {
        var belonging = Array(0 ..< graph.count)
        var totals = graph.degree
        for _ in 0 ..< Self.passes {
            var moved = false
            for node in 0 ..< graph.count {
                var links: [Int: Double] = [:]
                for link in graph.neighbours[node] {
                    links[belonging[link.node], default: 0] += link.weight
                }
                let mine = belonging[node]
                totals[mine] -= graph.degree[node]
                let best = best(for: node, among: links, staying: mine, against: totals)
                totals[best] += graph.degree[node]
                if best != mine {
                    belonging[node] = best
                    moved = true
                }
            }
            guard moved else { break }
        }
        return belonging
    }

    /// The community one node gains most by joining, and its own where nothing beats staying.
    ///
    /// Walked in community order rather than the dictionary's own, because a dictionary is walked
    /// differently on every launch: two communities pulling equally on one file would otherwise
    /// take it in turns, and one unchanged repository would draw a different map every time.
    private func best(
        for node: Int,
        among links: [Int: Double],
        staying mine: Int,
        against totals: [Double],
    )
        -> Int {
        var best = mine
        var most = gain(mine, links[mine] ?? 0, node, totals)
        for community in links.keys.sorted() {
            let here = gain(community, links[community] ?? 0, node, totals)
            guard here > most + Self.decisive else { continue }
            most = here
            best = community
        }
        return best
    }

    /// What joining one community is worth: its links to this node, less what the two would share
    /// by chance at this resolution.
    private func gain(_ community: Int, _ weight: Double, _ node: Int, _ totals: [Double])
        -> Double {
        weight - resolution * totals[community] * graph.degree[node] / graph.volume
    }
}
