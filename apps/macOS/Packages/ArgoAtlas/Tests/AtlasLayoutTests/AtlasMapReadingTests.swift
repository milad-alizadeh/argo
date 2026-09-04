import AtlasFixtures
@testable import AtlasLayout
import Testing

/// What a real measurement reads as. Every number below was measured off this repository at commit
/// 4478553 and is asserted against the committed fixture, so a change to the shape that quietly
/// loses a file, a measure or a level of nesting fails here rather than on the first repository.
@Suite("Atlas — reading a measured Map")
struct AtlasMapReadingTests {
    private let evidence = "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Evidence"
    private let fixtures = "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/Fixtures"

    @Test func `every measured file arrives as a Plot`() throws {
        #expect(try AtlasMapFixture.argo().plots.count == 89)
    }

    @Test func `a Plot's path is the nesting it was found at`() throws {
        // Eleven levels below the root, which is the deep case the fixture was kept for: a path
        // assembled one component short reads as a file in the wrong folder rather than as an
        // error.
        let plot = try AtlasMapFixture.plot(
            "\(evidence)/Syntax/EvidenceLanguage.swift",
            in: AtlasMapFixture.argo(),
        )
        #expect(plot.name == "EvidenceLanguage.swift")
        #expect(plot.path.split(separator: "/").count == 12)
    }

    @Test func `a Plate's number is its Plots summed`() throws {
        let map = try AtlasMapFixture.argo()
        let rules = try AtlasMapFixture.plate("argo/rules", in: map)
        // house.md and swift.md, 45 lines and 72. Stated as the two numbers and their sum, because
        // a Plate that stored a number of its own would pass a test that only checked it was set.
        #expect(rules.plots.map { $0.measures["lines"] } == [45, 72])
        #expect(rules.total(of: "lines") == 117)
    }

    @Test func `a Plate sums through every level under it`() throws {
        let map = try AtlasMapFixture.argo()
        // The whole map summed one way against the same map summed Plot by Plot: the two agree
        // only if the walk reaches every level, which one that stopped at the first folder would
        // not.
        let everyPlot = map.plots.reduce(0.0) { $0 + ($1.measures["lines"] ?? 0) }
        #expect(map.root.total(of: "lines") == everyPlot)
        #expect(map.root.total(of: "lines") == 9902)
    }

    @Test func `one enormous file keeps its measures whole`() throws {
        // 4,800 lines against a median of 61. The outlier is in the fixture on purpose, and a
        // reader that clamped or bucketed on the way in would lose it here.
        let plot = try AtlasMapFixture.plot(
            "\(fixtures)/settled-session.jsonl",
            in: AtlasMapFixture.argo(),
        )
        #expect(plot.measures["lines"] == 4800)
        #expect(plot.measures["bytes"] == 4_799_264)
    }

    @Test func `a file measuring zero measures zero, not nothing`() throws {
        let plot = try AtlasMapFixture.plot(
            "\(fixtures)/settled-session.jsonl",
            in: AtlasMapFixture.argo(),
        )
        #expect(plot.measures["age_in_weeks"] == 0)
    }

    @Test func `a measure a file never carried is absent, and sums as nothing`() throws {
        // A PNG has no lines to count, which is not the same as counting zero of them. The bag
        // says absent and the sum says zero, and the two readings have to stay apart.
        let plot = try AtlasMapFixture.plot(
            "argo/docs/designs/composer-picker/at.png",
            in: AtlasMapFixture.argo(),
        )
        #expect(plot.measures["lines"] == nil)
        #expect(AtlasNode.plot(plot).total(of: "lines") == 0)
    }

    @Test func `the Map names every measure it holds, in one settled order`() throws {
        // Sorted rather than in encounter order: everything that offers the reader a choice of
        // measure reads this list, and a set walked in its own order changes it on every launch.
        #expect(try AtlasMapFixture.argo().measureNames == [
            "age_in_weeks", "authors", "bytes", "commits", "lines",
        ])
    }

    @Test func `the Map says which repository state it measured`() throws {
        // What a later ticket compares against the repository to say how far behind the reading is.
        #expect(try AtlasMapFixture.argo().commit == "4478553597b9f54568ed277d3753aba87ab1d980")
    }
}
