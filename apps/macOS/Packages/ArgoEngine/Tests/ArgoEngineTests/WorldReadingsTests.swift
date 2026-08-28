@testable import ArgoEngine
import Foundation
import Testing

/// The world outside the transcripts, driven directly rather than through a Hub: what the process
/// table and git said about the repository's working trees, and what the readings answer before
/// either has been read.
@Suite("World readings")
@MainActor
struct WorldReadingsTests {
    private static let repository = "/tmp/argo-world"
    private static let linked = "/tmp/argo-world/.claude/worktrees/ticket-259"

    @Test
    func `a folder the process table names is running an agent`() async {
        let readings = Self.readings(runningIn: [Self.repository])

        await readings.refreshLiveness()

        #expect(readings.liveness(inCwd: Self.repository, lastActivityAtMs: Self.nowMs) == .live)
    }

    @Test
    func `a folder nobody is running in is quiet`() async {
        let readings = Self.readings(runningIn: ["/tmp/argo-elsewhere"])

        await readings.refreshLiveness()

        #expect(readings.liveness(inCwd: Self.repository, lastActivityAtMs: Self.nowMs) == .quiet)
    }

    /// `lsof` answers with the symlinks already followed and a transcript reports the path its
    /// agent was launched with. Compared as written, the match would never fire.
    @Test
    func `a folder reached through a symlink is the same folder`() async throws {
        let folder = "/tmp/argo-world-\(UUID().uuidString)"
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(atPath: folder) }
        #expect(resolvedPath(folder) != folder)
        let readings = Self.readings(runningIn: [resolvedPath(folder)])

        await readings.refreshLiveness()

        #expect(readings.liveness(inCwd: folder, lastActivityAtMs: Self.nowMs) == .live)
    }

    /// Before the first poll there is no clock to judge recency against, so a Session mid-turn
    /// still reads quiet — the degrade-down rule, at the one place it can fire.
    @Test
    func `an unread world says nothing about a Session mid-turn`() {
        let readings = Self.readings(runningIn: [Self.repository])

        #expect(readings.liveness(inCwd: Self.repository, lastActivityAtMs: Self.nowMs) == .quiet)
        #expect(readings.workspace(inCwd: Self.repository) == nil)
    }

    @Test
    func `every worktree git listed is read, Session or no Session`() async {
        // The reason the sweep is driven off git's listing: `worktree-gc` reaps only after a pull
        // request merges, so a worktree that outlived the run that made it is the ordinary case.
        let readings = Self.readings(cwds: [])

        await readings.refreshWorkspaces()

        #expect(readings.readWorkspaces.compactMap(\.branch) == ["main", "ticket-259"])
    }

    @Test
    func `a Session is answered with the worktree its folder sits in`() async {
        let readings = Self.readings(cwds: [Self.repository])

        await readings.refreshWorkspaces()

        #expect(readings.workspace(inCwd: Self.repository)?.branch == "main")
        #expect(readings.workspace(inCwd: Self.repository + "/apps/macOS")?.branch == "main")
    }

    /// A linked worktree sits INSIDE the primary checkout, so the shallowest match would answer
    /// every Session in the repository with `main`.
    @Test
    func `the innermost worktree holding a folder is the one that answers`() async {
        let readings = Self.readings(cwds: [Self.linked])

        await readings.refreshWorkspaces()

        #expect(readings.workspace(inCwd: Self.linked)?.branch == "ticket-259")
        #expect(readings.workspace(inCwd: Self.linked + "/apps")?.branch == "ticket-259")
    }

    @Test
    func `a folder in no worktree Argo read is answered with nothing`() async {
        let readings = Self.readings(cwds: [Self.repository])

        await readings.refreshWorkspaces()

        // Compared on a separator, so a sibling folder whose name merely starts the same is out.
        #expect(readings.workspace(inCwd: "/tmp/argo-world-old") == nil)
        #expect(readings.workspace(inCwd: "/tmp/elsewhere") == nil)
    }

    @Test
    func `how many Agents are in a worktree is counted where the roster is known`() async {
        let readings = Self.readings(cwds: [Self.repository, Self.repository, Self.linked])

        await readings.refreshWorkspaces()

        // Each folder credited to the DEEPEST worktree holding it and to nothing above that:
        // otherwise the primary checkout would claim every Session in the repository.
        #expect(readings.workspace(inCwd: Self.repository)?.held.count == 2)
        #expect(readings.workspace(inCwd: Self.linked)?.held.count == 1)
    }

    @Test
    func `a worktree nobody is running in is honestly held by nobody`() async {
        let readings = Self.readings(cwds: [Self.repository])

        await readings.refreshWorkspaces()

        #expect(readings.workspace(inCwd: Self.linked)?.held == .unattributed)
    }

    /// One subprocess run per WORKTREE: four Sessions in one worktree must not cost four.
    @Test
    func `git is asked once per worktree, however many Sessions share it`() async {
        let asked = ReadCounter()
        let readings = Self.readings(
            cwds: [Self.repository, Self.repository, Self.linked],
            workspace: { _ in await asked.record() },
        )

        await readings.refreshWorkspaces()

        #expect(await asked.count == 2)
    }

    @Test
    func `a worktree git cannot answer for keeps no entry at all`() async {
        let readings = Self.readings(cwds: [Self.repository], workspace: { _ in nil })

        await readings.refreshWorkspaces()

        // An unread Workspace is not a clean one, and neither is an unanswerable folder.
        #expect(readings.workspace(inCwd: Self.repository) == nil)
    }

    /// AC5: a Project folder that is not a git repository yields no workspace facts rather than
    /// empty ones — and with no listing there is nothing even to ask about.
    @Test
    func `a folder in no repository yields no Workspace facts at all`() async {
        let readings = Self.readings(cwds: [Self.repository], worktrees: { _ in [] })

        await readings.refreshWorkspaces()

        #expect(readings.readWorkspaces.isEmpty)
        #expect(readings.workspace(inCwd: Self.repository) == nil)
    }

    @Test
    func `a Hub pointed nowhere drops the branches it was holding`() async {
        let readings = Self.readings(cwds: [Self.repository], repository: { nil })
        await readings.refreshWorkspaces()

        #expect(readings.readWorkspaces.isEmpty)
        // Going on answering with the last Project's worktrees would be a fact about a
        // repository nobody is on.
        #expect(readings.workspace(inCwd: Self.repository) == nil)
    }

    @Test
    func `stopping drops everything the readings knew about the machine`() async {
        let readings = Self.readings(runningIn: [Self.repository], cwds: [Self.repository])
        await readings.refreshLiveness()
        await readings.refreshWorkspaces()
        #expect(readings.liveness(inCwd: Self.repository, lastActivityAtMs: Self.nowMs) == .live)
        #expect(readings.workspace(inCwd: Self.repository) != nil)

        await readings.stop()

        #expect(readings.liveness(inCwd: Self.repository, lastActivityAtMs: Self.nowMs) == .quiet)
        #expect(readings.workspace(inCwd: Self.repository) == nil)
    }

    private static var nowMs: Int {
        Date().epochMs
    }

    /// Readings over a machine running an agent in each folder named, whose repository holds the
    /// two worktrees below. Every case above differs only in what those reads were found to say.
    private static func readings(
        runningIn live: Set<String> = [],
        cwds: [String] = [],
        worktrees: @escaping WorktreeEnumerationRead = twoWorktrees,
        workspace: @escaping WorkspaceRead = branchNamedAfterFolder,
        repository: @escaping @MainActor () -> URL? = { URL(fileURLWithPath: repository) },
    )
        -> WorldReadings {
        WorldReadings(
            engine: Engine(
                readCheckout: CheckoutFixture().read,
                readWorktrees: worktrees,
                readWorkspace: workspace,
                readLiveness: { live },
            ),
            repositoryURL: repository,
            sessions: { cwds.map { SessionActivity(cwd: $0, lastSeenAtMs: nowMs) } },
        )
    }
}

/// A repository holding its own checkout and one linked worktree under `.claude/worktrees/` — the
/// nesting every path case above turns on. Outside the suite because the reads are handed to an
/// `Engine` and run off the main actor.
private let twoWorktrees: WorktreeEnumerationRead = { _ in
    [
        WorktreeEntry(path: "/tmp/argo-world", branch: "main", headSha: "aaa", kind: .main),
        WorktreeEntry(
            path: "/tmp/argo-world/.claude/worktrees/ticket-259",
            branch: "ticket-259", headSha: "bbb", kind: .worktree,
        ),
    ]
}

/// What git would say about a worktree, named after the branch the listing found — so a test can
/// tell which read answered which entry.
private let branchNamedAfterFolder: WorkspaceRead = { entry in
    WorkspaceProjection(
        kind: entry.kind,
        branch: entry.branch,
        dirty: 0,
        divergence: UpstreamDivergence(ahead: 0, behind: 0),
    )
}

/// How many times git was asked, for the one case that is about the count rather than the answer.
private actor ReadCounter {
    private(set) var count = 0

    func record() -> WorkspaceProjection? {
        count += 1
        return nil
    }
}
