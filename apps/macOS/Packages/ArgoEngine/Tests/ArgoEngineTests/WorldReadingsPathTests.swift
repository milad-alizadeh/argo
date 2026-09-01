@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// What the readings ask the file system to spell, and when (#959).
///
/// These cases assert a CALL COUNT, which `rules/testing.md` otherwise warns off: a count is an
/// implementation fact, and a suite that pins one pins the implementation. It is the subject here.
/// The defect was `realpath(3)` twice per Session per read of the roster, on the main actor, and
/// "how often the file system was asked" is the whole of what was wrong — an assertion about the
/// answers would have passed before the fix and after it (ADR-0028, cost is a gate).
@Suite("World readings paths")
@MainActor
struct WorldReadingsPathTests {
    @Test
    func `a roster read asks the file system nothing`() async {
        let log = ResolveLog()
        let readings = Self.readings(logging: log)
        await readings.refreshLiveness()
        await readings.refreshWorkspaces()
        let afterOneSweep = log.paths.count

        for _ in 0 ..< 10 {
            _ = readings.liveness(inCwd: linked, lastActivityAtMs: Self.nowMs)
            _ = readings.workspace(inCwd: linked)
        }

        #expect(afterOneSweep > 0)
        #expect(log.paths.count == afterOneSweep)
    }

    @Test
    func `the liveness poll asks nothing about a folder the sweep has spelled`() async {
        let log = ResolveLog()
        let readings = Self.readings(logging: log)
        await readings.refreshWorkspaces()
        let afterTheSweep = log.count(of: linked)

        await readings.refreshLiveness()

        #expect(afterTheSweep == 1)
        #expect(log.count(of: linked) == afterTheSweep)
    }

    /// What is cached is the resolution of a SYMLINK, not a Session's location: a Session stays
    /// where it was started and a symlink does not have to. So the sweep asks again rather than
    /// answering out of a table nothing else would ever move.
    @Test
    func `a folder whose symlink has been repointed is respelled by the next sweep`() async {
        let log = ResolveLog()
        let readings = Self.readings(logging: log)
        await readings.refreshWorkspaces()
        #expect(readings.workspace(inCwd: linked)?.branch == "main")

        log.leadsElsewhere = true
        await readings.refreshWorkspaces()

        #expect(readings.workspace(inCwd: linked) == nil)
        #expect(log.count(of: linked) == 2)
    }

    /// The table is bounded by the roster and the repository rather than by every folder the window
    /// has ever been pointed at: a folder that left takes its entry with it, which is visible as
    /// the gap-filling spelling having to ask about it again when it comes back.
    @Test
    func `a folder nothing asks about any more is forgotten`() async {
        let log = ResolveLog()
        let folders = Folders(cwds: [linked, other])
        let readings = Self.readings(logging: log, watching: folders)
        await readings.refreshWorkspaces()

        folders.cwds = [linked]
        await readings.refreshWorkspaces()
        await readings.spell(theProjectRootAnd: [other], settling: .foldersNotYetSpelled)

        #expect(log.count(of: other) == 2)
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

    /// The window the table OPENS, and the call that closes it. Before the table, every read
    /// resolved live, so a Session that appeared between sweeps matched its process at once; held
    /// answers alone, it would match nothing until the next sweep. `Hub.didApply()` and
    /// `Hub.spawnSession` make this call for the two ways a folder joins the roster.
    @Test
    func `a folder named after the last sweep is spelled without waiting for the next`() async {
        let folders = Folders(cwds: [])
        let readings = Self.readings(logging: ResolveLog(), watching: folders)
        await readings.refreshLiveness()
        #expect(readings.liveness(inCwd: linked, lastActivityAtMs: Self.nowMs) == .quiet)

        folders.cwds = [linked]
        await readings.spell(theProjectRootAnd: folders.cwds, settling: .foldersNotYetSpelled)

        #expect(readings.liveness(inCwd: linked, lastActivityAtMs: Self.nowMs) == .live)
    }

    /// The table is observed, so a folder spelled for the first time re-renders what reads it.
    /// Written unobserved, a Session that appeared between sweeps would keep the nothing it was
    /// answered with for as long as git went on saying the same thing.
    ///
    /// The folder this watches is OUTSIDE the repository's one worktree, so the sweep publishes no
    /// workspace and no holder count either time: the spelling is the only thing that moves.
    @Test
    func `a folder spelled for the first time invalidates what read it`() async {
        let folders = Folders(cwds: [])
        let readings = Self.readings(logging: ResolveLog(), watching: folders)
        await readings.refreshWorkspaces()
        let watcher = Tripwire.watching { _ = readings.workspace(inCwd: other) }

        folders.cwds = [other]
        await readings.refreshWorkspaces()

        #expect(watcher.fired)
    }

    private static var nowMs: Int {
        Date().epochMs
    }

    /// Readings over a machine whose one worktree git names by its resolved path, with an agent
    /// running in it, and a roster that names it the way a transcript would.
    private static func readings(
        logging log: ResolveLog,
        watching folders: Folders = .theOneSession,
    )
        -> WorldReadings {
        WorldReadings(
            engine: Engine(reads: .init(
                checkout: CheckoutFixture().read,
                worktrees: { _ in
                    [WorktreeEntry(path: worktree, branch: "main", headSha: "aaa", kind: .main)]
                },
                workspace: { entry in
                    WorkspaceProjection(
                        kind: entry.kind,
                        branch: entry.branch,
                        dirty: 0,
                        divergence: UpstreamDivergence(ahead: 0, behind: 0),
                    )
                },
                liveness: { [worktree] },
                paths: { await log.read($0) },
            )),
            repositoryURL: { URL(fileURLWithPath: worktree) },
            sessions: { folders.cwds.map { SessionActivity(cwd: $0, lastSeenAtMs: nowMs) } },
        )
    }
}

/// Every path the readings handed the file system, in the order they asked. Behind a `Mutex`
/// because the resolve runs off the main actor.
private final class ResolveLog: Sendable {
    private let asked = Mutex<[String]>([])
    private let repointed = Mutex(false)

    /// Whether the fixture's symlink now leads somewhere else — what a `git worktree move`, or a
    /// worktree folder deleted and recreated, looks like to `realpath`.
    var leadsElsewhere: Bool {
        get { repointed.withLock { $0 } }
        set { repointed.withLock { $0 = newValue } }
    }

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
        let elsewhere = leadsElsewhere
        return paths.reduce(into: [String: String]()) { spelled, path in
            guard path.hasPrefix("/tmp/") else {
                spelled[path] = path
                return
            }
            spelled[path] = elsewhere ? "/private/tmp/moved" + path : "/private" + path
        }
    }
}

/// Which folders the readings are watching Sessions in, which a case may move between sweeps.
private final class Folders: Sendable {
    static var theOneSession: Folders {
        Folders(cwds: [linked])
    }

    private let watched: Mutex<[String]>

    init(cwds: [String]) {
        self.watched = Mutex(cwds)
    }

    var cwds: [String] {
        get { watched.withLock { $0 } }
        set { watched.withLock { $0 = newValue } }
    }
}

/// The folder as a transcript spells it, and as git and `lsof` do.
private let linked = "/tmp/argo-paths"
private let worktree = "/private/tmp/argo-paths"
/// A second folder, outside that worktree, so a case can watch one join and leave.
private let other = "/tmp/argo-paths-other"
