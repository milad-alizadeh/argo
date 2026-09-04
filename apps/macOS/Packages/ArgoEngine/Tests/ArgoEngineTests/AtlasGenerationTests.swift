@testable import ArgoEngine
import Foundation
import Testing

/// What lands on the map when the generator is pointed at a real repository — which files, in what
/// order, under which folders — measured against the fixture repository the bundle beside these
/// tests carries. What each file MEASURES is the suite next door.
///
/// Every claim here is one a reader could check by eye against the repository. Nothing asserts how
/// the measurement was taken.
@Suite("Atlas generation")
struct AtlasGenerationTests {
    /// The head of the fixture bundle. Fixed because the recipe fixes every author, date and
    /// message that goes into it.
    private static let head = "392deca8011072b99a48f548262164e4da3e04bd"

    @Test
    func `every tracked file is a Plot, and a deleted one is not`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plots.map(\.path) == [
            "measured/.gitignore",
            "measured/README.md",
            "measured/assets/logo.bin",
            "measured/notes/a file with spaces.txt",
            "measured/notes/café.txt",
            "measured/notes/deep/one/two/three/leaf.txt",
            "measured/notes/empty.txt",
            "measured/notes/unterminated.txt",
            "measured/src/app/main.swift",
        ])
    }

    /// The line is committed versus not, drawn at the repository's boundary rather than at Argo's
    /// (#655) — so git's own answer about what is tracked is the whole rule, and neither of these
    /// needs a rule of its own.
    @Test
    func `a file git does not track is not on the map`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        try fixture.write("noisy.log", saying: "ignored\n", in: repositoryURL)
        try fixture.write("scratch.txt", saying: "untracked\n", in: repositoryURL)

        let map = await atlasGenerator().measure(at: repositoryURL)

        #expect(!map.plots.map(\.path).contains("measured/noisy.log"))
        #expect(!map.plots.map(\.path).contains("measured/scratch.txt"))
    }

    /// Folders are Plates and hold no number of their own, so this is the sum of what stands on
    /// them — five levels of Plate over one Plot.
    @Test
    func `folders nest as the repository does`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.root.path == "measured")
        #expect(map.plate("measured/notes/deep/one/two/three")?.total(of: "lines") == 1)
        #expect(map.plate("measured/src")?.total(of: "lines") == 5)
    }

    @Test
    func `the Map records the commit it measured`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.commit == Self.head)
        #expect(map.measuredAt == atlasMeasuredAt)
    }

    /// The failure this guards is a dictionary walked in its own order, which is how a map comes
    /// out different on every launch and a tiler lays out a different city each time.
    @Test
    func `the same repository measures the same way twice`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()

        let first = await atlasGenerator().measure(at: repositoryURL)
        let second = await atlasGenerator().measure(at: repositoryURL)

        #expect(first == second)
    }

    /// The map exists for any registered git repository with no prior setup (#655), so this asserts
    /// the absence the fixture was built to have: it carries none of Argo's own furniture and is
    /// measured whole regardless.
    @Test
    func `a repository with none of Argo's own files still measures`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        let paths = map.plots.map(\.path)
        #expect(!paths.contains { $0.contains("CONTEXT.md") || $0.contains("AGENTS.md") })
        #expect(!paths.contains { $0.contains("docs/adr") || $0.contains("rules/") })
        #expect(map.plots.count == 9)
    }

    /// The co-change counting, on a real history rather than on one written in a test: the
    /// thresholds are put by `AtlasCoChangeTests`, and what is claimed here is that the map a
    /// repository produces states ties between the files that repository committed together.
    @Test
    func `files committed together are coupled, as often as they shared a commit`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        // `README.md` and `main.swift` are the two files of the first commit that changed again in
        // the second, and neither has changed without the other: every commit either touched is a
        // commit both were in.
        #expect(map.strength(
            between: "measured/README.md", and: "measured/src/app/main.swift",
        ) == 1)
        // `leaf.txt` shares the first commit with `README.md` and has never changed since, so one
        // of the two commits `README.md` was in.
        #expect(map.strength(
            between: "measured/README.md",
            and: "measured/notes/deep/one/two/three/leaf.txt",
        ) == 0.5)
    }

    @Test
    func `a file the working tree no longer holds is nobody's company`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        // `gone.txt` was committed and then deleted. It is in the history and not on the map, and
        // a tie to it could not be drawn beside anything.
        #expect(!map.couplings.contains { $0.first.hasSuffix("gone.txt") })
        #expect(!map.couplings.contains { $0.second.hasSuffix("gone.txt") })
    }

    @Test
    func `a repository of one commit produces a map and no couplings`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.repositoryWithOneCommit())

        #expect(map.plots.count == 2)
        #expect(map.couplings.isEmpty)
    }

    @Test
    func `a repository with no commits still produces a map`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.repositoryWithNoCommits())

        #expect(map.commit == nil)
        #expect(map.root.path == "unborn")
        #expect(map.plots.isEmpty)
    }
}
