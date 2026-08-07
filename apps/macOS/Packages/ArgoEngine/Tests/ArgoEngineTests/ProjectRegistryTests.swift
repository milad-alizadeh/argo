@testable import ArgoEngine
import Foundation
import Testing

/// The one piece of glue Argo owns rather than observes: which repositories this machine knows, and
/// which one the cockpit opens into.
@Suite("Project registry")
struct ProjectRegistryTests {
    @Test
    func `registering a repository creates a Project keyed to a stable id`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.folder("cockpit", git: true)
        let store = fixture.store()

        let registered = await store.register(at: repositoryURL)
        let reloaded = await store.load()

        let project = try #require(registered.projects.first)
        #expect(project.path == repositoryURL.path)
        #expect(reloaded.projects.map(\.id) == [project.id])
    }

    /// An unregistered folder on disk is not a Project: nothing exists until registration.
    @Test
    func `a machine that never registered knows no Projects`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }

        let registry = await fixture.store().load()

        #expect(registry == .empty)
        #expect(registry.active == nil)
    }

    @Test
    func `one git root is one Project, however deep the folder offered`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.folder("monorepo", git: true)
        let packageURL = try fixture.folder("monorepo/apps/macOS")
        let store = fixture.store()

        await store.register(at: packageURL)
        let registry = await store.register(at: repositoryURL)

        #expect(registry.projects.map(\.path) == [repositoryURL.path])
    }

    @Test
    func `the first Project registered is the one the cockpit opens into`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let first = try fixture.folder("first", git: true)
        let second = try fixture.folder("second", git: true)
        let store = fixture.store()

        await store.register(at: first)
        let registry = await store.register(at: second)

        #expect(registry.active?.path == first.path)
    }

    @Test
    func `switching the active Project survives a reload`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.folder("first", git: true)
        let second = try fixture.folder("second", git: true)
        let store = fixture.store()
        await store.register(at: fixture.rootURL.appending(path: "first"))
        let registry = await store.register(at: second)
        let secondID = try #require(registry.projects.last?.id)

        await store.activate(id: secondID)
        let reloaded = await store.load()

        #expect(reloaded.active?.path == second.path)
    }

    /// The path is a mutable attribute of a stable id, so links keyed on the id survive a move.
    @Test
    func `a moved Project keeps the id it was registered under`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let originalURL = try fixture.folder("cockpit", git: true)
        let store = fixture.store()
        let registered = await store.register(at: originalURL)
        let id = try #require(registered.projects.first?.id)

        let movedURL = try fixture.move(originalURL, to: "archive/cockpit")
        await store.relocate(id: id, to: movedURL)
        let reloaded = await store.load()

        #expect(reloaded.projects.map(\.id) == [id])
        #expect(reloaded.projects.map(\.path) == [movedURL.path])
    }

    @Test
    func `a Project whose folder has disappeared is still known`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.folder("cockpit", git: true)
        let store = fixture.store()
        await store.register(at: repositoryURL)

        try fixture.remove(repositoryURL)
        let registry = await store.load()

        #expect(registry.projects.map(\.path) == [repositoryURL.path])
    }

    @Test
    func `a Project reads reachable exactly while its folder is there`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.folder("cockpit", git: true)
        let store = fixture.store()
        let registered = await store.register(at: repositoryURL)
        #expect(registered.projects.map(\.isReachable) == [true])

        try fixture.remove(repositoryURL)
        let reloaded = await store.load()

        #expect(reloaded.projects.map(\.isReachable) == [false])
    }

    @Test
    func `a registry file that cannot be read is an empty one`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("{ \"projects\": [ ")

        let registry = await fixture.store().load()

        #expect(registry == .empty)
    }

    @Test
    func `a record carrying no path is dropped, the rest of the file still reading`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        {
          "activeProjectId": "kept",
          "projects": [{ "id": "broken" }, { "id": "kept", "path": "/tmp/kept" }]
        }
        """)

        let registry = await fixture.store().load()

        #expect(registry.projects.map(\.id) == ["kept"])
        #expect(registry.active?.path == "/tmp/kept")
    }

    @Test
    func `an active id no record carries reads as no active Project`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        try fixture.writeRegistryFile("""
        { "activeProjectId": "gone", "projects": [{ "id": "kept", "path": "/tmp/kept" }] }
        """)

        let registry = await fixture.store().load()

        #expect(registry.projects.map(\.id) == ["kept"])
        #expect(registry.active == nil)
    }

    @Test
    func `activating an id no record carries leaves the active Project alone`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.folder("cockpit", git: true)
        let store = fixture.store()
        let registered = await store.register(at: repositoryURL)

        let registry = await store.activate(id: "never-registered")

        #expect(registry.active?.id == registered.active?.id)
    }

    @Test
    func `a Project takes its name from the folder it was registered at`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repositoryURL = try fixture.folder("cockpit", git: true)

        let registry = await fixture.store().register(at: repositoryURL)

        #expect(registry.projects.map(\.name) == ["cockpit"])
    }
}
