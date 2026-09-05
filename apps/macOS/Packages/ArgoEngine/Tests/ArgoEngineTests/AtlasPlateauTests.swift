@testable import ArgoEngine
import Testing

/// How far two readings of the same files agree, over partitions written here: the Rand index has
/// known values on shapes this small, which is the only way to say the arithmetic is the
/// arithmetic and not something that merely looks like it.
@Suite("Atlas — two readings agreeing")
struct AtlasAgreementTests {
    @Test func `one partition agrees with itself completely`() {
        #expect(AtlasAgreement.between([0, 0, 1, 1], [0, 0, 1, 1]) == 1)
    }

    @Test func `the same grouping under other names is the same grouping`() {
        // A community id is a label, not a number: two clusterings that grouped the same files
        // agree whatever they called the groups.
        #expect(AtlasAgreement.between([0, 0, 1, 1], [7, 7, 4, 4]) == 1)
    }

    @Test func `one file moved is most pairs still agreed on`() {
        // Six pairs among four files. Moving the third file breaks the pair it was in and makes
        // two the other reading does not hold, so three of the six are still read the same way.
        let same = AtlasAgreement.between([0, 0, 1, 1], [0, 0, 0, 1])

        #expect(same == 3.0 / 6.0)
    }

    @Test func `a file either reading placed nowhere is no evidence either way`() {
        // A file that belongs to nothing is not a file the two readings disagree about.
        let placed = AtlasAgreement.between([0, 0, 1, 1], [0, 0, 1, 1])
        let withOneOut = AtlasAgreement.between([0, 0, 1, 1], [0, 0, 1, AtlasAgreement.unplaced])

        #expect(placed == 1)
        #expect(withOneOut == 1)
    }

    @Test func `fewer than two files placed have no pairs to agree about`() {
        let out = AtlasAgreement.unplaced

        #expect(AtlasAgreement.between([0, out, out], [0, out, out]) == nil)
    }
}

/// Which resolution a graph settles at, over graphs whose answer is not in dispute.
@Suite("Atlas — the resolution a repository settles at")
struct AtlasPlateauTests {
    @Test func `a graph with an obvious grain settles on it`() {
        // Three tight triangles joined by threads: the partition that separates them is the same
        // one over most of the knob's range, which is what a plateau IS.
        var weights: [AtlasPair: Double] = [:]
        for clump in 0 ..< 3 {
            let base = clump * 3
            for pair in [(0, 1), (1, 2), (0, 2)] {
                weights[AtlasPair(base + pair.0, base + pair.1)] = 1
            }
        }
        weights[AtlasPair(2, 3)] = 0.02
        weights[AtlasPair(5, 6)] = 0.02
        let chosen = AtlasPlateau.chosen(over: AtlasGraph(count: 9, weights: weights))

        #expect(chosen.settled)
        #expect(Set(chosen.belonging).count == 3)
        #expect(AtlasPlateau.sweep.contains(chosen.resolution))
    }

    @Test func `a graph with no grain at all says it did not settle`() {
        // No plateau is a real answer, and the one the whole sweep exists to be able to give. A
        // dense graph wired by a formula has no grain to find: every turn of the knob cuts it
        // somewhere else, and nothing here may paper that over into a confident partition.
        //
        // Wired by a stated recurrence rather than a random generator, because a suite whose
        // graph differs per run is a suite that fails on somebody else's machine.
        var noisy: [AtlasPair: Double] = [:]
        var seed = 1
        for one in 0 ..< 40 {
            for other in (one + 1) ..< 40 {
                seed = (seed &* 1_103_515_245 &+ 12345) & 0x7FFF_FFFF
                if seed % 100 < 35 {
                    noisy[AtlasPair(one, other)] = 1
                }
            }
        }
        let chosen = AtlasPlateau.chosen(over: AtlasGraph(count: 40, weights: noisy))

        #expect(!chosen.settled)
    }

    @Test func `the same graph settles at the same resolution twice`() {
        var weights: [AtlasPair: Double] = [:]
        for pair in [(0, 1), (1, 2), (0, 2), (3, 4), (4, 5), (3, 5)] {
            weights[AtlasPair(pair.0, pair.1)] = 1
        }
        weights[AtlasPair(2, 3)] = 0.05
        let graph = AtlasGraph(count: 6, weights: weights)

        #expect(AtlasPlateau.chosen(over: graph).resolution
            == AtlasPlateau.chosen(over: graph).resolution)
    }
}
