/// Which files actually belong to the community they were put in, and how surely (#1157).
///
/// Louvain places every node somewhere: it is a partition, and a partition has no way to say "I
/// do not know". That is the wrong answer for a repository, where a script, a lockfile and a
/// stray asset genuinely belong to no subject at all — and a map that shows them coloured as
/// though they did is a map that lies quietly.
///
/// So a file KEEPS its community only where it is more that community than the runner-up by a
/// margin. The test is a ratio, so it carries no repository-specific scale, and the same number
/// is what the file is drawn washed out by.
struct AtlasMembership {
    /// How few files a community may hold and still be a Domain, asked BEFORE the margin and
    /// again after it. Two files sharing one word are a coincidence rather than a subject, and a
    /// map of two-file domains is a map of noise.
    static let smallest = 3

    /// What a file that belongs to nothing is spelled as. Negative rather than an optional so a
    /// partition where every file belongs somewhere and one where files do not are one shape, and
    /// so the agreement between two of them can be taken without unwrapping either.
    static let unplaced = -1

    /// How far ahead the winning community has to be. A tenth and a half of the way, against a
    /// tie: below this the file is left to belong to nothing, which is a real answer.
    static let margin = 0.15

    /// The community each file kept, `Self.unplaced` where it kept none.
    let belonging: [Int]

    /// How surely each file kept it, 0 where it kept nothing.
    let confidence: [Double]

    /// One partition, judged against the graph it was taken over.
    init(of belonging: [Int], over graph: AtlasGraph) {
        var sizes: [Int: Int] = [:]
        for community in belonging {
            sizes[community, default: 0] += 1
        }
        var kept = [Int](repeating: Self.unplaced, count: belonging.count)
        var confidence = [Double](repeating: 0, count: belonging.count)
        for node in belonging.indices where (sizes[belonging[node]] ?? 0) >= Self.smallest {
            let held = Self.held(by: node, of: belonging, over: graph, sizes)
            guard held >= Self.margin else { continue }
            kept[node] = belonging[node]
            confidence[node] = held
        }
        // The floor again, on what is LEFT — which the prototype does not do, and is the one
        // place this departs from it. The floor was applied to the communities the partition
        // proposed; the margin then takes files out of them, and a community of four that kept
        // two is as much noise as a community of two was. Its files fall to belonging to nothing,
        // which they are already allowed to do.
        var held: [Int: Int] = [:]
        for community in kept where community != Self.unplaced {
            held[community, default: 0] += 1
        }
        for node in kept.indices where (held[kept[node]] ?? 0) < Self.smallest {
            kept[node] = Self.unplaced
            confidence[node] = 0
        }
        self.belonging = kept
        self.confidence = confidence
    }

    /// How far one file's own community outweighs the next one for it: their pull on the file
    /// against each other, over both together. Nothing at all for a file the graph never links,
    /// which is the file that belongs to nothing by every reading.
    ///
    /// Communities too small to be Domains are left out of the comparison entirely rather than
    /// counted as the runner-up: a file cannot lose its Domain to a group that is not one.
    private static func held(
        by node: Int,
        of belonging: [Int],
        over graph: AtlasGraph,
        _ sizes: [Int: Int],
    )
        -> Double {
        var pull: [Int: Double] = [:]
        for link in graph.neighbours[node] where (sizes[belonging[link.node]] ?? 0) >= smallest {
            pull[belonging[link.node], default: 0] += link.weight
        }
        let mine = pull[belonging[node]] ?? 0
        let next = pull.filter { $0.key != belonging[node] }.values.max() ?? 0
        guard mine + next > 0 else { return 0 }
        return (mine - next) / (mine + next)
    }
}
