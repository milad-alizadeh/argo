/// A weighted undirected graph over file POSITIONS, which is what both signals reduce to (#1157).
///
/// The clustering below never sees a path or a filename: names become edge weights and so do
/// commits, and everything after that is one graph. That is the whole reason two signals can be
/// blended at all, and the reason a clustering of one signal is the same code as a clustering of
/// both — which is what makes the agreement between them worth reporting.
struct AtlasGraph {
    /// How many nodes, including any the edges never mention. Carried rather than inferred from
    /// the edges, because a file that shares no word with anything and changed alone is a real
    /// file that belongs to nothing, and a graph that dropped it would place it silently.
    let count: Int

    /// Every edge, by its two ends. One pair is one entry, whichever end the counting reached it
    /// from.
    let weights: [AtlasPair: Double]

    /// For each node, the nodes on the other end of its edges. Built once: the local move walks
    /// this on every pass over every node.
    let neighbours: [[AtlasLink]]

    /// For each node, the total weight of the edges at it.
    let degree: [Double]

    /// Twice the total edge weight — the `2m` every modularity formula divides by. Never zero, so
    /// a graph with no edges at all divides rather than traps; every gain over it is zero, which
    /// leaves every node in a community of its own, which is the right answer for that graph.
    let volume: Double

    init(count: Int, weights: [AtlasPair: Double]) {
        var neighbours = [[AtlasLink]](repeating: [], count: count)
        var degree = [Double](repeating: 0, count: count)
        var volume = 0.0
        for (pair, weight) in weights {
            volume += 2 * weight
            guard pair.first != pair.second else {
                degree[pair.first] += 2 * weight
                continue
            }
            neighbours[pair.first].append(AtlasLink(node: pair.second, weight: weight))
            neighbours[pair.second].append(AtlasLink(node: pair.first, weight: weight))
            degree[pair.first] += weight
            degree[pair.second] += weight
        }
        self.count = count
        self.weights = weights
        // Sorted because a dictionary is walked in its own order, and the local move takes the
        // first best community it meets: unsorted, one unchanged repository would draw a
        // different map on every launch.
        self.neighbours = neighbours.map { $0.sorted { $0.node < $1.node } }
        self.degree = degree
        self.volume = volume > 0 ? volume : 1
    }
}

/// One end of one edge, seen from the other end.
struct AtlasLink {
    let node: Int
    let weight: Double
}

/// Two nodes, ordered on the way in, so one pair is one key however it was reached.
struct AtlasPair: Hashable, Comparable {
    let first: Int
    let second: Int

    init(_ one: Int, _ other: Int) {
        self.first = min(one, other)
        self.second = max(one, other)
    }

    static func < (lhs: AtlasPair, rhs: AtlasPair) -> Bool {
        (lhs.first, lhs.second) < (rhs.first, rhs.second)
    }
}
