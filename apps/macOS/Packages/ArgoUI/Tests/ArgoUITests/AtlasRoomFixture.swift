@testable import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// A room to open, and a repository for it to be about — everything the Atlas room's suites stand
/// on, in one place because two of them stand on it (#1159 added the second).
///
/// Every path is a throwaway folder, never the machine's own application support: a suite that
/// wrote a Map file for a real Project would leave it there, and one that READ the written layer
/// from there would say whatever a developer's own checkout happens to have beside it. The channel
/// preferences take a defaults suite of their own for the same reason — these Project ids collide
/// with a real checkout named `argo`, and `UserDefaults.standard` is that developer's.
@MainActor
enum AtlasRoomFixture {
    /// A room over a Map directory nobody has written anything into yet.
    static func room() throws -> (model: AtlasRoomModel, rootURL: URL) {
        let rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-atlas-room-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        return try (room(reusing: rootURL).model, rootURL)
    }

    /// A second model over a Map directory `room()` already made — what "reopening the Atlas" is,
    /// for a test.
    static func room(reusing rootURL: URL) throws -> (model: AtlasRoomModel, rootURL: URL) {
        let suite = try #require(
            UserDefaults(suiteName: "argo.atlas-room-\(UUID().uuidString)"),
            "The suite could not make defaults of its own.",
        )
        return (
            AtlasRoomModel(
                store: AtlasMapStore(directoryURL: rootURL),
                notesStore: AtlasNotesStore(directoryURL: rootURL),
                preferences: AtlasChannelPreferences(defaults: suite),
            ),
            rootURL,
        )
    }

    static func project(_ id: String, at rootURL: URL) -> CockpitPresentation.Project {
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
    static func makeRepository(at url: URL) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        try git(["init", "--quiet"], at: url)
        try commit("first", at: url)
    }

    /// One more commit on a repository `makeRepository` already started — the working tree moving
    /// on past a Map that was measured before it (#1162).
    static func commit(_ message: String, at url: URL) throws {
        try git([
            "-c", "user.name=Ada Lovelace", "-c", "user.email=ada@example.com",
            "commit", "--quiet", "--allow-empty", "-m", message,
        ], at: url)
    }

    /// A file committed into a fixture repository, so the Map has a Plot a Note can be about
    /// (#1159).
    static func commitFile(_ name: String, saying text: String, in repositoryURL: URL) throws {
        try text.write(
            to: repositoryURL.appending(path: name), atomically: true, encoding: .utf8,
        )
        try git(["add", "--all"], at: repositoryURL)
        try commit("a file", at: repositoryURL)
    }

    static func git(_ arguments: [String], at url: URL) throws {
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
}
