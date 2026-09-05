@testable import ArgoEngine
import AtlasLayout
import Foundation
import Testing

/// What comes back off a Project's written layer file, read against the repository it was written
/// about (#1159).
@Suite("Atlas written layer store")
struct AtlasNotesStoreTests {
    private func project(at repositoryURL: URL) -> ProjectRecord {
        ProjectRecord(id: "6E7C0E1A-0C3E-4F5B-9E9A-2F0B7B0C1D2E", path: repositoryURL.path)
    }

    /// A written layer put beside the Map by hand, which is how one arrives: nothing in Argo
    /// writes one, because a note is read out of the code rather than measured out of it.
    private func write(
        _ json: String,
        for record: ProjectRecord,
        in fixture: AtlasRepositoryFixture,
    ) throws
        -> AtlasNotesStore {
        let store = AtlasNotesStore(directoryURL: fixture.mapDirectoryURL)
        try FileManager.default.createDirectory(
            at: fixture.mapDirectoryURL, withIntermediateDirectories: true,
        )
        try json.write(to: store.fileURL(of: record), atomically: true, encoding: .utf8)
        return store
    }

    private func layer(about path: String, subject: String) -> String {
        """
        {"version": 1, "writtenAt": "2026-03-01T00:00:00Z", "model": "sonnet",
         "files": {"\(path)": {"note": "Where the program starts.",
                               "why": ["One of the largest files here."],
                               "subject": "\(subject)"}}}
        """
    }

    /// The ticket's second criterion at the seam that decides it: a Project with no written layer
    /// costs its reader nothing and is told nothing, and no error is raised over a file nobody
    /// promised.
    @Test func `a Project with no written layer beside its Map is told nothing, not an error`()
        async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let map = await atlasGenerator().measure(at: repositoryURL)
        let store = AtlasNotesStore(directoryURL: fixture.mapDirectoryURL)

        let notes = await store.notes(of: project(at: repositoryURL), in: map)

        #expect(notes.isEmpty)
    }

    @Test func `a note whose file still holds what it held reads as current`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let map = await atlasGenerator().measure(at: repositoryURL)
        let record = project(at: repositoryURL)
        let path = "measured/README.md"
        // The app's own digest rather than a second one written here: a test that hashed the file
        // its own way would pass while the store and the writer disagreed about what a subject is.
        let digest = try #require(AtlasSubject
            .digest(of: repositoryURL.appending(path: "README.md")))
        let store = try write(layer(about: path, subject: digest), for: record, in: fixture)

        let notes = await store.notes(of: record, in: map)

        #expect(notes.note(ofFile: path)?.standing == .current)
    }

    /// The last criterion: the file moved on, the sentence did not, and the reader is told which.
    @Test func `a note whose file has changed since is marked stale and stays`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let map = await atlasGenerator().measure(at: repositoryURL)
        let record = project(at: repositoryURL)
        let path = "measured/README.md"
        let store = try write(
            layer(about: path, subject: "0000000000000000"), for: record, in: fixture,
        )

        let notes = await store.notes(of: record, in: map)

        let note = try #require(notes.note(ofFile: path))
        #expect(note.standing == .stale)
        #expect(note.words == "Where the program starts.")
        #expect(note.flag == ["One of the largest files here."])
    }

    /// A written layer taken before a rename names files the map has no Plot for. Nothing is
    /// opened for one — the store reads no file the map is not already drawing — so the Note
    /// stands unchecked rather than being called stale by a check that never ran.
    @Test func `a note about a path the Map does not draw is left unchecked`() async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let map = await atlasGenerator().measure(at: repositoryURL)
        let record = project(at: repositoryURL)
        let path = "measured/src/app/renamed.swift"
        let store = try write(
            layer(about: path, subject: "0000000000000000"), for: record, in: fixture,
        )

        let notes = await store.notes(of: record, in: map)

        #expect(notes.note(ofFile: path)?.standing == .unchecked)
    }

    @Test func `a written layer file that will not parse says nothing rather than failing`()
        async throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.measuredRepository()
        let map = await atlasGenerator().measure(at: repositoryURL)
        let record = project(at: repositoryURL)
        let store = try write("half a wri", for: record, in: fixture)

        let notes = await store.notes(of: record, in: map)

        #expect(notes.isEmpty)
    }

    /// One file per Project, named the way its Map is and beside it, so a reader looking for
    /// either finds both in one folder.
    @Test func `a Project's written layer is named after the Project, beside its Map`() throws {
        let fixture = try AtlasRepositoryFixture()
        defer { fixture.remove() }
        let record = try project(at: fixture.measuredRepository())
        let store = AtlasNotesStore(directoryURL: fixture.mapDirectoryURL)

        #expect(store.fileURL(of: record)
            == fixture.mapDirectoryURL.appending(path: record.id + ".notes.json"))
    }
}
