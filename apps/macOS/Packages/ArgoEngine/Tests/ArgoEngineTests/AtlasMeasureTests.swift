@testable import ArgoEngine
import Foundation
import Testing

/// What each file on the map measures, against the fixture repository built to carry a hard case
/// for every branch: a binary, a file of no bytes, a last line with no newline, a file two people
/// touched, and one the reader cannot open at all.
@Suite("Atlas measures")
struct AtlasMeasureTests {
    @Test
    func `a file carries its own bytes and lines`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plot("measured/README.md")?.measures["bytes"] == 8)
        #expect(map.plot("measured/README.md")?.measures["lines"] == 2)
        #expect(map.plot("measured/src/app/main.swift")?.measures["bytes"] == 50)
        #expect(map.plot("measured/src/app/main.swift")?.measures["lines"] == 5)
    }

    /// A file of no bytes measures zero rather than nothing, which is the value a band on a log
    /// scale has to survive.
    @Test
    func `a file with no bytes in it measures zero`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plot("measured/notes/empty.txt")?.measures["bytes"] == 0)
        #expect(map.plot("measured/notes/empty.txt")?.measures["lines"] == 0)
    }

    /// `wc -l` would call this file empty. It has one line and no newline after it.
    @Test
    func `a last line with no newline after it is still a line`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plot("measured/notes/unterminated.txt")?.measures["lines"] == 1)
    }

    /// Absent, not zero: a PNG has no lines to count rather than zero of them, and anything drawing
    /// `lines` has to draw it anyway.
    @Test
    func `a binary file has bytes and no lines at all`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plot("measured/assets/logo.bin")?.measures["bytes"] == 13)
        #expect(map.plot("measured/assets/logo.bin")?.measures["lines"] == nil)
    }

    @Test
    func `a file carries the commits and the people that touched it`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plot("measured/src/app/main.swift")?.measures["commits"] == 3)
        #expect(map.plot("measured/src/app/main.swift")?.measures["authors"] == 2)
        #expect(map.plot("measured/notes/deep/one/two/three/leaf.txt")?.measures["commits"] == 1)
        #expect(map.plot("measured/notes/deep/one/two/three/leaf.txt")?.measures["authors"] == 1)
    }

    @Test
    func `a file's age is whole weeks since the last commit that touched it`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }

        let map = try await atlasGenerator().measure(at: fixture.measuredRepository())

        #expect(map.plot("measured/src/app/main.swift")?.measures["age_in_weeks"] == 2)
        #expect(map.plot("measured/README.md")?.measures["age_in_weeks"] == 6)
        #expect(map.plot("measured/notes/deep/one/two/three/leaf.txt")?
            .measures["age_in_weeks"] == 10)
    }

    /// A path git tracks and has no history for. It carries what its bytes say and NONE of the
    /// three history measures — three zeroes would read as a file nobody has ever touched.
    @Test
    func `a staged file with no commit behind it is measured without a history`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.repositoryWithNoCommits()
        try fixture.stage("first.txt", saying: "one\n", in: repositoryURL)

        let map = await atlasGenerator().measure(at: repositoryURL)

        #expect(map.plot("unborn/first.txt")?.measures == ["bytes": 4, "lines": 1])
    }

    /// Counted as present with the measures it could get, never dropped: git says the file is in
    /// the repository, and a map that quietly lost it would say the repository is smaller than it
    /// is.
    @Test
    func `a file the reader cannot open keeps the measures it could get`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        try FileManager.default.setAttributes(
            [.posixPermissions: 0], ofItemAtPath: repositoryURL.appending(path: "README.md").path,
        )

        let map = await atlasGenerator().measure(at: repositoryURL)

        #expect(map.plot("measured/README.md")?.measures == [
            "commits": 2,
            "authors": 2,
            "age_in_weeks": 6,
        ])
    }
}
