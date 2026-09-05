@testable import ArgoEngine
import AtlasLayout
import Foundation
import Testing

/// Two weeks after the fixture repository's last commit, six after its second and ten after its
/// first, so every age the Atlas suites assert is a whole number a reader can check against
/// `Fixtures/Atlas/make-measured.sh`.
let atlasMeasuredAt = Date(iso8601: "2026-03-16T09:00:00Z")

/// A generator on a stopped clock, which is what makes an age assertable at all.
func atlasGenerator() -> AtlasMapGenerator {
    AtlasMapGenerator(now: { atlasMeasuredAt })
}

/// A real repository on disk to measure, and a throwaway folder for the Map file it produces.
///
/// `measured.bundle` is cloned rather than checked in as a tree, because a `.git` directory cannot
/// be committed inside another repository. What comes out is a genuine working tree with genuine
/// history — the same commit SHAs, authors and dates on every machine — which is the only way a
/// test can assert what the generator made of a repository rather than what a stub said.
///
/// `Fixtures/Atlas/README.md` says what the bundle carries and why each file is in it.
struct AtlasRepositoryFixture {
    let rootURL: URL

    init() throws {
        self.rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-atlas-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    /// Where a Map file written for a Project lands, under this fixture rather than under the
    /// machine's real application support.
    var mapDirectoryURL: URL {
        rootURL.appending(path: "atlas", directoryHint: .isDirectory)
    }

    /// The bundled repository, cloned into a working tree.
    func measuredRepository() throws -> URL {
        let bundleURL = try #require(Bundle.module.url(
            forResource: "measured", withExtension: "bundle", subdirectory: "Fixtures/Atlas",
        ))
        let repositoryURL = rootURL.appending(path: "measured", directoryHint: .isDirectory)
        try run(["git", "clone", "--quiet", bundleURL.path, repositoryURL.path])
        return repositoryURL.standardizedFileURL
    }

    /// A repository with no commits in it. The one case the bundle cannot carry, because there is
    /// nothing to bundle: `git bundle create` refuses a history with no commits in it.
    func repositoryWithNoCommits() throws -> URL {
        let repositoryURL = rootURL.appending(path: "unborn", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(
            at: repositoryURL,
            withIntermediateDirectories: true,
        )
        try run(["git", "init", "--quiet", repositoryURL.path])
        return repositoryURL.standardizedFileURL
    }

    /// A repository whose whole history is its first commit. Two files that arrived together and
    /// have never once changed together, which is the case the co-change counting must state
    /// nothing about (#1149).
    func repositoryWithOneCommit() throws -> URL {
        let repositoryURL = rootURL.appending(path: "first", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(
            at: repositoryURL,
            withIntermediateDirectories: true,
        )
        try run(["git", "init", "--quiet", repositoryURL.path])
        try write("a.swift", saying: "let a = 1\n", in: repositoryURL)
        try write("b.swift", saying: "let b = 2\n", in: repositoryURL)
        try run(["git", "-C", repositoryURL.path, "add", "-A"])
        // The machine's own config is out of the way, so an identity is given here or git refuses
        // to commit at all.
        try run([
            "git", "-C", repositoryURL.path,
            "-c", "user.name=Ada Lovelace", "-c", "user.email=ada@example.com",
            "commit", "--quiet", "-m", "the first files",
        ])
        return repositoryURL.standardizedFileURL
    }

    /// Adds a file to a repository's index without committing it — a path git tracks and has no
    /// history for.
    func stage(_ name: String, saying text: String, in repositoryURL: URL) throws {
        try write(name, saying: text, in: repositoryURL)
        try run(["git", "-C", repositoryURL.path, "add", name])
    }

    /// Commits whatever is staged — the repository moving on past a commit a Map already named
    /// (#1162).
    func commitStaged(in repositoryURL: URL, message: String = "a later commit") throws {
        try run([
            "git", "-C", repositoryURL.path,
            "-c", "user.name=Ada Lovelace", "-c", "user.email=ada@example.com",
            "commit", "--quiet", "-m", message,
        ])
    }

    /// Writes a file into a working tree and leaves it there, tracked or not.
    func write(_ name: String, saying text: String, in repositoryURL: URL) throws {
        try text.write(
            to: repositoryURL.appending(path: name), atomically: true, encoding: .utf8,
        )
    }

    private func run(_ arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = arguments
        // The machine's own git config is taken out of the way, so `init.defaultBranch`,
        // `commit.gpgsign` and `diff.renames` cannot change what these fixtures are. The rest of
        // the environment is kept: `/usr/bin/env` needs a PATH to find git at all.
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

extension Date {
    /// Test-only: the instant an ISO 8601 string names, which is how these suites spell one.
    init(iso8601: String) {
        self = ISO8601DateFormatter().date(from: iso8601) ?? .distantPast
    }
}

extension AtlasMap {
    /// Test-only: the Plot at a path, which is how these suites name one.
    func plot(_ path: String) -> AtlasPlot? {
        plots.first { $0.path == path }
    }

    /// Test-only: how tightly two Plots are coupled, `nil` where the Map states no tie.
    func strength(between first: String, and second: String) -> Double? {
        couplings.first { $0.partner(of: first) == second }?.strength
    }

    /// Test-only: the Plate at a path.
    func plate(_ path: String) -> AtlasPlate? {
        plates(of: .plate(root)).first { $0.path == path }
    }

    private func plates(of node: AtlasNode) -> [AtlasPlate] {
        guard case let .plate(plate) = node else { return [] }
        return [plate] + plate.children.flatMap(plates(of:))
    }
}

extension AtlasCoupling {
    /// Test-only: the other end, for a path at one end of this Coupling, and `nil` for a path it
    /// does not join. Here rather than on the type, which nothing outside these suites asks yet.
    func partner(of path: String) -> String? {
        switch path {
        case first: second
        case second: first
        default: nil
        }
    }
}
