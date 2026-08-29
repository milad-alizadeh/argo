@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// What the readings ask the file system to spell, and when (#959).
///
/// A Session's folder does not move while it is running, so `realpath` is a question answered at
/// the spawn: asked once per path per Project, and never once per read of the roster. Every case
/// here counts what the file system was asked rather than what the readings answered.
@Suite("World readings paths")
@MainActor
struct WorldReadingsPathTests {
    @Test
    func `a path is spelled once, however many times the roster is read`() async {
        let log = ResolveLog()
        let readings = Self.readings(logging: log)
        await readings.refreshLiveness()
        await readings.refreshWorkspaces()
        let afterOneSweep = log.paths.count

        for _ in 0 ..< 10 {
            _ = readings.liveness(inCwd: linked, lastActivityAtMs: Self.nowMs)
            _ = readings.workspace(inCwd: linked)
        }

        #expect(log.count(of: linked) == 1)
        #expect(log.paths.count == afterOneSweep)
    }

    @Test
    func `a second sweep asks nothing about a path already spelled`() async {
        let log = ResolveLog()
        let readings = Self.readings(logging: log)
        await readings.refreshLiveness()
        await readings.refreshWorkspaces()

        await readings.refreshLiveness()
        await readings.refreshWorkspaces()

        #expect(log.count(of: linked) == 1)
        #expect(log.count(of: worktree) == 1)
    }

    /// The table is bounded by the roster and the repository rather than by every folder the window
    /// has ever been pointed at: a Session that left takes its entry with it.
    @Test
    func `a folder nothing asks about any more is forgotten`() async {
        let log = ResolveLog()
        let roster = Roster(cwds: [linked, other])
        let readings = Self.readings(logging: log, roster: roster)
        await readings.refreshWorkspaces()

        roster.cwds = [linked]
        await readings.refreshWorkspaces()
        roster.cwds = [linked, other]
        await readings.refreshWorkspaces()

        #expect(log.count(of: other) == 2)
        #expect(log.count(of: linked) == 1)
    }

    /// `lsof` and git answer with the symlinks already followed; a transcript reports the path its
    /// agent was launched with. The readings answer about the folder either way.
    @Test
    func `a Session recorded under a symlink is the folder git named`() async {
        let readings = Self.readings(logging: ResolveLog())

        await readings.refreshLiveness()
        await readings.refreshWorkspaces()

        #expect(readings.liveness(inCwd: linked, lastActivityAtMs: Self.nowMs) == .live)
        #expect(readings.workspace(inCwd: linked)?.branch == "main")
    }

    /// The table is observed, so a folder spelled for the first time re-renders what reads it.
    /// Written unobserved, a Session that appeared between sweeps would keep the nothing it was
    /// answered with for as long as git went on saying the same thing.
    ///
    /// The folder this watches is OUTSIDE the repository's one worktree, so the sweep publishes no
    /// workspace and no holder count either time: the spelling is the only thing that moves.
    @Test
    func `a folder spelled for the first time invalidates what read it`() async {
        let roster = Roster(cwds: [])
        let readings = Self.readings(logging: ResolveLog(), roster: roster)
        await readings.refreshWorkspaces()
        let watcher = Tripwire.watching { _ = readings.workspace(inCwd: other) }

        roster.cwds = [other]
        await readings.refreshWorkspaces()

        #expect(watcher.fired)
    }

    private static var nowMs: Int {
        Date().epochMs
    }

    /// Readings over a machine whose one worktree git names by its resolved path, with an agent
    /// running in it, and a roster that names it the way a transcript would.
    private static func readings(logging log: ResolveLog, roster: Roster = Roster(cwds: [linked]))
        -> WorldReadings {
        WorldReadings(
            engine: Engine(
                readCheckout: CheckoutFixture().read,
                readWorktrees: { _ in
                    [WorktreeEntry(path: worktree, branch: "main", headSha: "aaa", kind: .main)]
                },
                readWorkspace: { entry in
                    WorkspaceProjection(
                        kind: entry.kind,
                        branch: entry.branch,
                        dirty: 0,
                        divergence: UpstreamDivergence(ahead: 0, behind: 0),
                    )
                },
                readLiveness: { [worktree] },
                readPaths: { await log.read($0) },
            ),
            repositoryURL: { URL(fileURLWithPath: worktree) },
            sessions: { roster.cwds.map { SessionActivity(cwd: $0, lastSeenAtMs: nowMs) } },
        )
    }
}

/// Every path the readings handed the file system, in the order they asked. Behind a `Mutex`
/// because the resolve runs off the main actor.
private final class ResolveLog: Sendable {
    private let asked = Mutex<[String]>([])

    var paths: [String] {
        asked.withLock { $0 }
    }

    func count(of path: String) -> Int {
        paths.count { $0 == path }
    }

    /// The fixture file system: everything under `/tmp` is really under `/private/tmp`, which is
    /// what macOS itself does and what the two spellings above are.
    func read(_ paths: [String]) async -> [String: String] {
        asked.withLock { $0 += paths }
        return paths.reduce(into: [String: String]()) { spelled, path in
            spelled[path] = path.hasPrefix("/tmp/") ? "/private" + path : path
        }
    }
}

/// Which folders the Hub is watching Sessions in, which a case may move between sweeps.
private final class Roster: Sendable {
    private let folders: Mutex<[String]>

    init(cwds: [String]) {
        self.folders = Mutex(cwds)
    }

    var cwds: [String] {
        get { folders.withLock { $0 } }
        set { folders.withLock { $0 = newValue } }
    }
}

/// The folder as a transcript spells it, and as git and `lsof` do.
private let linked = "/tmp/argo-paths"
private let worktree = "/private/tmp/argo-paths"
/// A second Session's folder, so a case can watch one leave the roster.
private let other = "/tmp/argo-paths-other"
