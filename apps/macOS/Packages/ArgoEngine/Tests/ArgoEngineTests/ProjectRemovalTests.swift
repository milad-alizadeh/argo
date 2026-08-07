@testable import ArgoEngine
import Foundation
import Testing

/// Taking a Project OUT of the registry. Its own suite because removal is the transition that can
/// leave the cockpit pointed at nothing, and every rule below is about where it lands instead.
@Suite("Project removal")
struct ProjectRemovalTests {
    /// Removal takes the registration and nothing else — the folder on disk is never touched.
    @Test
    func `removing a Project drops that record and leaves the rest in order`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let first = try fixture.folder("first", git: true)
        let second = try fixture.folder("second", git: true)
        let third = try fixture.folder("third", git: true)
        let store = fixture.store()
        await store.register(at: first)
        let middle = try #require(await store.register(at: second).project?.id)
        await store.register(at: third)

        await store.remove(id: middle)
        let reloaded = await store.load()

        #expect(reloaded.projects.map(\.path) == [first.path, third.path])
        #expect(FileManager.default.fileExists(atPath: second.path))
    }

    @Test
    func `removing the active Project lands the cockpit on another one`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let first = try fixture.folder("first", git: true)
        let second = try fixture.folder("second", git: true)
        let store = fixture.store()
        let active = try #require(await store.register(at: first).project?.id)
        await store.register(at: second)

        let removed = await store.remove(id: active)

        #expect(removed.registry.active?.path == second.path)
        #expect(removed.project?.path == second.path)
    }

    @Test
    func `removing a background Project leaves the active one where it was`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let first = try fixture.folder("first", git: true)
        let second = try fixture.folder("second", git: true)
        let store = fixture.store()
        await store.register(at: first)
        let background = try #require(await store.register(at: second).project?.id)

        let removed = await store.remove(id: background)

        #expect(removed.registry.active?.path == first.path)
    }

    @Test
    func `removing the last Project leaves an empty registry and no active id`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let only = try fixture.folder("only", git: true)
        let store = fixture.store()
        let identifier = try #require(await store.register(at: only).project?.id)

        let removed = await store.remove(id: identifier)
        let reloaded = await store.load()

        #expect(removed.project == nil)
        #expect(reloaded == .empty)
        #expect(reloaded.active == nil)
    }

    @Test
    func `removing an id no record carries changes nothing`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let only = try fixture.folder("only", git: true)
        let store = fixture.store()
        let registered = await store.register(at: only).registry

        let removed = await store.remove(id: "never-registered").registry

        #expect(removed == registered)
    }

    /// Every other transition still holds once removal exists, a moved Project included.
    @Test
    func `the set and the active Project round-trip through the file after a move`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let doomed = try fixture.folder("doomed", git: true)
        let kept = try fixture.folder("kept", git: true)
        let store = fixture.store()
        let doomedID = try #require(await store.register(at: doomed).project?.id)
        let keptID = try #require(await store.register(at: kept).project?.id)

        await store.remove(id: doomedID)
        let movedURL = try fixture.move(kept, to: "archive/kept")
        await store.relocate(id: keptID, to: movedURL)
        let reloaded = await store.load()

        #expect(reloaded.projects.map(\.id) == [keptID])
        #expect(reloaded.projects.map(\.path) == [movedURL.path])
        #expect(reloaded.active?.id == keptID)
    }
}
