@testable import ArgoEngine
import AtlasLayout
import Foundation
import Testing

/// Where a Project's Map file lands, and what comes back off it.
@Suite("Atlas map store")
struct AtlasMapStoreTests {
    private func project(at repositoryURL: URL) -> ProjectRecord {
        ProjectRecord(id: "6E7C0E1A-0C3E-4F5B-9E9A-2F0B7B0C1D2E", path: repositoryURL.path)
    }

    private func store(_ fixture: AtlasRepositoryFixture) -> AtlasMapStore {
        AtlasMapStore(
            directoryURL: fixture.mapDirectoryURL,
            generator: atlasGenerator(),
        )
    }

    /// One file per Project, keyed on the Project's id rather than its path, so a Project that
    /// moves keeps the Map it already has.
    @Test
    func `a Project's Map file is named after the Project`() throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let record = try project(at: fixture.measuredRepository())

        let fileURL = store(fixture).fileURL(of: record)

        #expect(fileURL == fixture.mapDirectoryURL.appending(path: record.id + ".json"))
    }

    @Test
    func `a Map generated for a Project is the Map read back for it`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let record = try project(at: fixture.measuredRepository())
        let store = store(fixture)

        let generated = await store.generate(for: record)

        #expect(try await store.map(of: record) == generated)
        #expect(FileManager.default.fileExists(atPath: store.fileURL(of: record).path))
    }

    /// Nothing measured and a measurement that will not read are different instructions to the
    /// reader — "rebuilding will fix this" against "the measurement could not be read" — so the
    /// first is an absence and only the second is an error.
    @Test
    func `a Project that has never been measured has no Map and no error`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let record = try project(at: fixture.measuredRepository())

        #expect(try await store(fixture).map(of: record) == nil)
    }

    @Test
    func `a Map file that will not parse is an error, not an empty repository`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let record = try project(at: fixture.measuredRepository())
        let store = store(fixture)
        try FileManager.default.createDirectory(
            at: fixture.mapDirectoryURL, withIntermediateDirectories: true,
        )
        try "half a wri".write(
            to: store.fileURL(of: record), atomically: true, encoding: .utf8,
        )

        await #expect(throws: AtlasMapError.self) { try await store.map(of: record) }
    }

    /// A file that is THERE and will not open is the same instruction as one that will not parse:
    /// the measurement could not be read. Only a file that was never written is an absence.
    @Test
    func `a Map file the process cannot open is an error too`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let record = try project(at: fixture.measuredRepository())
        let store = store(fixture)
        await store.generate(for: record)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0], ofItemAtPath: store.fileURL(of: record).path,
        )

        await #expect(throws: AtlasMapError.self) { try await store.map(of: record) }
    }

    /// The Map is Argo's own state and belongs beside the registry that names the Project, never in
    /// the repository it measured.
    @Test
    func `the Map file lands in per-machine app data and not in the repository`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let record = project(at: repositoryURL)

        await store(fixture).generate(for: record)

        #expect(AtlasMapStore.defaultDirectoryURL.path.hasSuffix("Argo/atlas"))
        #expect(!FileManager.default.fileExists(
            atPath: repositoryURL.appending(path: record.id + ".json").path,
        ))
    }

    /// How far the repository has moved past the commit a Map was measured against (#1162).
    @Test
    func `commitsBehind counts what the repository has done since the Map was measured`(
    ) async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let record = project(at: repositoryURL)
        let store = store(fixture)
        let map = await store.generate(for: record)

        try fixture.stage("later.swift", saying: "let later = 1\n", in: repositoryURL)
        try fixture.commitStaged(in: repositoryURL)

        #expect(store.commitsBehind(of: map, project: record) == 1)
    }

    /// A map current with the repository is behind it by nothing, not by an absence — the two read
    /// differently to `AtlasRoomView` (#1162).
    @Test
    func `commitsBehind is zero for a Map the repository has not moved past`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let record = project(at: repositoryURL)
        let store = store(fixture)

        let map = await store.generate(for: record)

        #expect(store.commitsBehind(of: map, project: record) == 0)
    }

    /// A Map from a repository with no commits has nothing to be behind (#1162).
    @Test
    func `commitsBehind is nil for a Map with no commit recorded`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.repositoryWithNoCommits()
        let record = project(at: repositoryURL)
        let store = store(fixture)

        let map = await store.generate(for: record)

        #expect(map.commit == nil)
        #expect(store.commitsBehind(of: map, project: record) == nil)
    }
}
