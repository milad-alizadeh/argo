@testable import ArgoEngine
import Testing

/// What the community detection makes of a graph, over graphs written here: a shape whose answer
/// is not in dispute — two clumps joined by one thread — is the only way to say what "found the
/// structure" means without an oracle.
@Suite("Atlas — communities in a graph")
struct AtlasLouvainTests {
    /// Two triangles, joined by a single light edge. Six nodes, two obvious groups.
    private func dumbbell() -> AtlasGraph {
        var weights: [AtlasPair: Double] = [:]
        for pair in [AtlasPair(0, 1), AtlasPair(1, 2), AtlasPair(0, 2)] {
            weights[pair] = 1
        }
        for pair in [AtlasPair(3, 4), AtlasPair(4, 5), AtlasPair(3, 5)] {
            weights[pair] = 1
        }
        weights[AtlasPair(2, 3)] = 0.05
        return AtlasGraph(count: 6, weights: weights)
    }

    @Test func `two clumps joined by one thread are two communities`() {
        let found = AtlasLouvain.communities(of: dumbbell(), resolution: 1)

        #expect(found[0] == found[1])
        #expect(found[1] == found[2])
        #expect(found[3] == found[4])
        #expect(found[4] == found[5])
        #expect(found[0] != found[3])
    }

    @Test func `a node nothing links to is a community of one`() {
        // A file that shares no word with anything and has never changed with anything is a real
        // file. A graph built from the edges alone would not hold it, and it would be placed
        // silently — which is the opposite of being allowed to belong to nothing.
        var weights: [AtlasPair: Double] = [AtlasPair(0, 1): 1]
        weights[AtlasPair(1, 2)] = 1
        let found = AtlasLouvain.communities(
            of: AtlasGraph(count: 4, weights: weights),
            resolution: 1,
        )

        #expect(found.count == 4)
        #expect(found[3] != found[0])
    }

    @Test func `turning the resolution up never draws fewer communities`() {
        // The reason the plateau is looked for in the PARTITION rather than in this count: it
        // rises with the knob for nearly any graph, so a flat stretch of it hardly ever exists.
        let graph = dumbbell()
        let low = Set(AtlasLouvain.communities(of: graph, resolution: 0.4)).count
        let high = Set(AtlasLouvain.communities(of: graph, resolution: 4)).count

        #expect(high >= low)
    }

    @Test func `one graph clustered twice comes out the same both times`() {
        // Dictionaries are walked in a different order on every launch, so every ordering this
        // depends on is settled by hand. Without that, one unchanged repository draws a different
        // map each time it is opened, which is the one thing a measurement may not do.
        let graph = dumbbell()

        #expect(AtlasLouvain.communities(of: graph, resolution: 1)
            == AtlasLouvain.communities(of: graph, resolution: 1))
    }

    @Test func `a graph with no edges at all leaves every node where it started`() {
        let found = AtlasLouvain.communities(
            of: AtlasGraph(count: 3, weights: [:]),
            resolution: 1,
        )

        #expect(Set(found).count == 3)
    }
}
