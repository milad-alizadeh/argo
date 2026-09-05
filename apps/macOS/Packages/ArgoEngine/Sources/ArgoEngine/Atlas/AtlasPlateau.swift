/// Which resolution to cluster a repository at, decided by the repository (#1157).
///
/// Maximum modularity reliably over-splits, and a target number of domains is a constant wearing
/// a formula's clothes. A plateau is the repository answering for itself: the grain at which its
/// own structure stops changing as the knob is turned.
///
/// The plateau is looked for in the PARTITION, not in the number of communities. The count rises
/// with the resolution for nearly any graph, so a flat stretch of it is a thing that hardly ever
/// exists; what does exist is a stretch where turning the knob stops moving files between
/// communities.
enum AtlasPlateau {
    /// The knob's settings, low to high. Twenty percent apart because a finer sweep costs a whole
    /// clustering per step and finds the same run, and nine steps is wide enough to hold a run of
    /// three at either end.
    static let sweep = (2 ... 10).map { Double($0) * 0.2 }

    /// How alike two neighbouring settings' partitions must be to count as the same answer.
    static let holds = 0.9

    /// How many settings in a row have to hold before the repository is taken to have settled on
    /// a grain of its own. Two neighbouring settings agreeing is a coincidence a smooth knob
    /// produces anywhere; three is a stretch.
    static let shortest = 3

    /// The resolution the repository settles at, the partition it gives, and whether it settled
    /// at all.
    ///
    /// The middle of the longest run is taken rather than either end, because the ends are where
    /// the answer is about to change and the middle is the run's own claim.
    static func chosen(over graph: AtlasGraph) -> AtlasPlateau.Choice {
        let steps = sweep.map {
            (resolution: $0, belonging: AtlasLouvain.communities(of: graph, resolution: $0))
        }
        var held = [Bool](repeating: false, count: steps.count)
        for step in 1 ..< steps.count {
            let same = AtlasAgreement.between(steps[step].belonging, steps[step - 1].belonging)
            held[step] = (same ?? 0) >= holds
        }
        let run = longestRun(in: held)
        let middle = (run.lowerBound + run.upperBound) / 2
        return Choice(
            resolution: steps[middle].resolution,
            belonging: steps[middle].belonging,
            settled: run.count >= shortest,
        )
    }

    /// The longest stretch of settings whose partitions agree, as a range over `sweep`. A stretch
    /// of one — no two neighbouring settings agreeing anywhere — comes back as the first setting,
    /// which is a real answer reported as one: `settled` is then false, and the Domains below are
    /// one arbitrary cut of a repository with no natural grain.
    private static func longestRun(in held: [Bool]) -> ClosedRange<Int> {
        var best = 0 ... 0
        var start = 0
        for step in 1 ..< held.count {
            if !held[step] {
                start = step
            }
            if step - start > best.upperBound - best.lowerBound {
                best = start ... step
            }
        }
        return best
    }

    /// What the sweep decided.
    struct Choice {
        let resolution: Double
        let belonging: [Int]

        /// False where no run of settings agreed. Stated rather than papered over: a partition
        /// taken at an arbitrary point of a knob that never stopped moving is a different kind of
        /// answer from one the repository held still for.
        let settled: Bool
    }
}
