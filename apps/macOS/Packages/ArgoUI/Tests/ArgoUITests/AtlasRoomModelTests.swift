@testable import ArgoEngine
@testable import ArgoUI
import AtlasLayout
import Foundation
import Testing

/// What the Atlas room reads on arriving at a Project, and what the reader's one lever does.
///
/// The store is pointed at a throwaway folder, never at the machine's own application support: a
/// suite that wrote a Map file for a real Project would leave it there. The channel preferences
/// take a suite of their own for the same reason — this suite's Project ids collide with a real
/// developer's own checkout named `argo`, and `UserDefaults.standard` is that developer's.
@MainActor
@Suite("Atlas room model")
struct AtlasRoomModelTests {
    private func fixture() throws -> (model: AtlasRoomModel, rootURL: URL) {
        let rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-atlas-room-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        let suite = try #require(
            UserDefaults(suiteName: "argo.atlas-room-\(UUID().uuidString)"),
            "The suite could not make defaults of its own.",
        )
        return (
            AtlasRoomModel(
                store: AtlasMapStore(directoryURL: rootURL),
                preferences: AtlasChannelPreferences(defaults: suite),
            ),
            rootURL,
        )
    }

    /// A second model over a Map directory a first `fixture()` already made — what "reopening the
    /// Atlas" is, for a test.
    private func fixture(reusing rootURL: URL) throws -> (model: AtlasRoomModel, rootURL: URL) {
        let suite = try #require(
            UserDefaults(suiteName: "argo.atlas-room-\(UUID().uuidString)"),
            "The suite could not make defaults of its own.",
        )
        return (
            AtlasRoomModel(
                store: AtlasMapStore(directoryURL: rootURL),
                preferences: AtlasChannelPreferences(defaults: suite),
            ),
            rootURL,
        )
    }

    private func project(_ id: String, at rootURL: URL) -> CockpitPresentation.Project {
        CockpitPresentation.Project(
            id: id,
            name: id,
            location: rootURL.appending(path: id).path,
            isReachable: true,
            isRegistered: true,
        )
    }

    /// A real repository with one commit, self-contained rather than borrowed from
    /// `ArgoEngineTests`' own fixture, which this target cannot see.
    private func makeRepository(at url: URL) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        try git(["init", "--quiet"], at: url)
        try commit("first", at: url)
    }

    /// One more commit on a repository `makeRepository` already started — the working tree moving
    /// on past a Map that was measured before it (#1162).
    private func commit(_ message: String, at url: URL) throws {
        try git([
            "-c", "user.name=Ada Lovelace", "-c", "user.email=ada@example.com",
            "commit", "--quiet", "--allow-empty", "-m", message,
        ], at: url)
    }

    private func git(_ arguments: [String], at url: URL) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["git", "-C", url.path] + arguments
        // Out of the way of the machine's own config, the same reason `AtlasRepositoryFixture`
        // gives (`ArgoEngineTests`): a default branch name or a signing setting must not decide
        // what this fixture is.
        var environment = ProcessInfo.processInfo.environment
        environment["GIT_CONFIG_GLOBAL"] = "/dev/null"
        environment["GIT_CONFIG_SYSTEM"] = "/dev/null"
        process.environment = environment
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
    }

    /// A window with no active Project has no repository to measure, which is a different sentence
    /// from a Project nobody has measured yet.
    @Test
    func `no active Project is not an unmeasured one`() async throws {
        let (model, _) = try fixture()

        await model.open(nil)

        #expect(model.reading == .noProject)
    }

    /// Nothing is measured on arriving: a first open that silently walked a repository would cost
    /// the reader a wait they never asked for.
    @Test
    func `a Project with no Map file reads as unmeasured, and nothing is written`() async throws {
        let (model, rootURL) = try fixture()

        await model.open(project("argo", at: rootURL))

        #expect(model.reading == .unmeasured)
        #expect(try FileManager.default.contentsOfDirectory(atPath: rootURL.path).isEmpty)
    }

    /// The reader's one lever, and the whole of what makes a map exist.
    @Test
    func `measuring writes a Map the next open reads back`() async throws {
        let (model, rootURL) = try fixture()
        let project = project("argo", at: rootURL)

        await model.rebuild(project)
        let measured = model.reading
        let (reopened, _) = try fixture(reusing: rootURL)
        await reopened.open(project)

        #expect(measured == reopened.reading)
        if case .measured = measured {} else {
            Issue.record("measuring left the room reading \(measured)")
        }
    }

    /// A window with no Map to draw has nothing to be behind (#1162).
    @Test
    func `an unmeasured Project is not behind anything`() async throws {
        let (model, rootURL) = try fixture()

        await model.open(project("argo", at: rootURL))

        #expect(model.behind == nil)
    }

    /// Just-generated is current, by construction: the Map names the commit the rebuild ran under.
    @Test
    func `rebuilding leaves the Map no commits behind`() async throws {
        let (model, rootURL) = try fixture()
        let repositoryURL = rootURL.appending(path: "argo", directoryHint: .isDirectory)
        try makeRepository(at: repositoryURL)

        await model.rebuild(project("argo", at: rootURL))

        #expect(model.behind == 0)
    }

    /// Arriving at a room whose Map now trails the repository states how far behind it is —
    /// re-read on the room's own open, not watched live (#1162).
    @Test
    func `reopening after the repository has moved states how far behind the Map is`(
    ) async throws {
        let (model, rootURL) = try fixture()
        let repositoryURL = rootURL.appending(path: "argo", directoryHint: .isDirectory)
        try makeRepository(at: repositoryURL)
        let project = project("argo", at: rootURL)
        await model.rebuild(project)

        try commit("second", at: repositoryURL)
        await model.open(nil)
        await model.open(project)

        #expect(model.behind == 1)
    }

    /// A window that switches Project must never go on drawing the last one's map (ADR-0015).
    @Test
    func `switching Project drops the map of the one being left`() async throws {
        let (model, rootURL) = try fixture()
        await model.rebuild(project("argo", at: rootURL))

        await model.open(project("cockpit", at: rootURL))

        #expect(model.reading == .unmeasured)
    }

    /// Leaving the room and coming back re-fires the same open, but the Project under it has not
    /// changed — so this must be a no-op rather than a second read. Proved by pulling the Map file
    /// out from under the model: a re-read would find nothing and drop to `.unmeasured`.
    @Test
    func `reopening the same Project reads nothing a second time`() async throws {
        let (model, rootURL) = try fixture()
        let project = project("argo", at: rootURL)
        await model.rebuild(project)
        let measured = model.reading

        try FileManager.default.removeItem(atPath: rootURL.path)
        await model.open(project)

        #expect(model.reading == measured)
    }
}
