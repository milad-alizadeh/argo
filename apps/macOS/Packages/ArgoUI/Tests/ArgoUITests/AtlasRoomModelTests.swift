@testable import ArgoEngine
@testable import ArgoUI
import AtlasLayout
import Foundation
import Testing

/// What the Atlas room reads on arriving at a Project, and what the reader's one lever does.
///
/// Every path it touches is a throwaway folder rather than the machine's own application support,
/// which is `AtlasRoomFixture`'s doing and the reason it exists.
@MainActor
@Suite("Atlas room model")
struct AtlasRoomModelTests {
    /// A window with no active Project has no repository to measure, which is a different sentence
    /// from a Project nobody has measured yet.
    @Test
    func `no active Project is not an unmeasured one`() async throws {
        let (model, _) = try AtlasRoomFixture.room()

        await model.open(nil)

        #expect(model.reading == .noProject)
    }

    /// Nothing is measured on arriving: a first open that silently walked a repository would cost
    /// the reader a wait they never asked for.
    @Test
    func `a Project with no Map file reads as unmeasured, and nothing is written`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()

        await model.open(AtlasRoomFixture.project("argo", at: rootURL))

        #expect(model.reading == .unmeasured)
        #expect(try FileManager.default.contentsOfDirectory(atPath: rootURL.path).isEmpty)
    }

    /// The reader's one lever, and the whole of what makes a map exist.
    @Test
    func `measuring writes a Map the next open reads back`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()
        let project = AtlasRoomFixture.project("argo", at: rootURL)

        await model.rebuild(project)
        let measured = model.reading
        let (reopened, _) = try AtlasRoomFixture.room(reusing: rootURL)
        await reopened.open(project)

        #expect(measured == reopened.reading)
        if case .measured = measured {} else {
            Issue.record("measuring left the room reading \(measured)")
        }
    }

    /// A window with no Map to draw has nothing to be behind (#1162).
    @Test
    func `an unmeasured Project is not behind anything`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()

        await model.open(AtlasRoomFixture.project("argo", at: rootURL))

        #expect(model.behind == nil)
    }

    /// Just-generated is current, by construction: the Map names the commit the rebuild ran under.
    @Test
    func `rebuilding leaves the Map no commits behind`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()
        let repositoryURL = rootURL.appending(path: "argo", directoryHint: .isDirectory)
        try AtlasRoomFixture.makeRepository(at: repositoryURL)

        await model.rebuild(AtlasRoomFixture.project("argo", at: rootURL))

        #expect(model.behind == 0)
    }

    /// Arriving at a room whose Map now trails the repository states how far behind it is —
    /// re-read on the room's own open, not watched live (#1162).
    @Test
    func `reopening after the repository has moved states how far behind the Map is`(
    ) async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()
        let repositoryURL = rootURL.appending(path: "argo", directoryHint: .isDirectory)
        try AtlasRoomFixture.makeRepository(at: repositoryURL)
        let project = AtlasRoomFixture.project("argo", at: rootURL)
        await model.rebuild(project)

        try AtlasRoomFixture.commit("second", at: repositoryURL)
        await model.open(nil)
        await model.open(project)

        #expect(model.behind == 1)
    }

    /// A window that switches Project must never go on drawing the last one's map (ADR-0015).
    @Test
    func `switching Project drops the map of the one being left`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()
        await model.rebuild(AtlasRoomFixture.project("argo", at: rootURL))

        await model.open(AtlasRoomFixture.project("cockpit", at: rootURL))

        #expect(model.reading == .unmeasured)
    }

    /// Leaving the room and coming back re-fires the same open, but the Project under it has not
    /// changed — so this must be a no-op rather than a second read. Proved by pulling the Map file
    /// out from under the model: a re-read would find nothing and drop to `.unmeasured`.
    @Test
    func `reopening the same Project reads nothing a second time`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()
        let project = AtlasRoomFixture.project("argo", at: rootURL)
        await model.rebuild(project)
        let measured = model.reading

        try FileManager.default.removeItem(atPath: rootURL.path)
        await model.open(project)

        #expect(model.reading == measured)
    }
}
